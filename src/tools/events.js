// Tool definitions and handlers; policy/transport enforcement is centralized.
export function registerEventsTools(
  server,
  {
    assertAllowedWritePath,
    buildUrlMatcher,
    clampNumber,
    ensureDir,
    ensureObservability,
    ensurePage,
    ensurePageEventListeners,
    getPageIdSafe,
    pushBounded,
    respond,
    runExpectAfterAction,
    state,
    withFrameMeta,
    withToolMeta,
    z,
  },
) {
  server.registerTool(
    "browser.list_dialogs",
    {
      description:
        "List dialogs captured from the page (alert/confirm/prompt/beforeunload).",
      inputSchema: {
        pageId: z.number().optional(),
        includeHandled: z.boolean().optional(),
      },
    },
    async ({ pageId, includeHandled }) => {
      const include = includeHandled ?? false;
      const items = state.dialogs
        .filter((entry) =>
          typeof pageId === "number" ? entry.pageId === pageId : true,
        )
        .filter((entry) => include || entry.status === "pending")
        .map((entry) => ({
          dialogId: entry.dialogId,
          pageId: entry.pageId,
          type: entry.type,
          message: entry.message,
          defaultValue: entry.defaultValue,
          createdAt: entry.createdAt,
          status: entry.status,
          resolution: entry.resolution,
          handledAt: entry.handledAt,
        }));
      return respond({ count: items.length, dialogs: items });
    },
  );

  server.registerTool(
    "browser.handle_dialog",
    {
      description: "Handle a pending dialog by dialogId.",
      inputSchema: {
        dialogId: z.string(),
        action: z.enum(["accept", "dismiss"]).optional(),
        promptText: z.string().optional(),
      },
    },
    async ({ dialogId, action, promptText }) => {
      const entry = state.dialogById.get(dialogId);
      if (!entry) {
        throw new Error(`Unknown dialogId "${dialogId}".`);
      }
      if (entry.status !== "pending") {
        return respond({
          status: entry.status,
          dialogId: entry.dialogId,
          handledAt: entry.handledAt,
          resolution: entry.resolution,
        });
      }

      if (entry._timer) clearTimeout(entry._timer);
      const act = action || "dismiss";
      if (act === "accept") {
        await entry._dialog.accept(promptText ?? undefined);
        entry.status = "accepted";
        entry.resolution = {
          action: "accept",
          promptText: typeof promptText === "string" ? promptText : null,
        };
      } else {
        await entry._dialog.dismiss();
        entry.status = "dismissed";
        entry.resolution = { action: "dismiss" };
      }
      entry.handledAt = new Date().toISOString();

      return respond({
        status: entry.status,
        dialogId: entry.dialogId,
        pageId: entry.pageId,
        handledAt: entry.handledAt,
      });
    },
  );

  server.registerTool(
    "browser.wait_for_download",
    {
      description: "Wait for the next download event and return its metadata.",
      inputSchema: {
        timeoutMs: z.number().optional(),
        pageId: z.number().optional(),
        peek: z.boolean().optional(),
      },
    },
    async ({ timeoutMs, pageId, peek }) => {
      const timeout = clampNumber(timeoutMs, 1000, 300000, 30000);
      const shouldPeek = peek ?? false;
      const start = Date.now();

      const findMatch = () =>
        state.downloads.find(
          (entry) =>
            !entry.consumed &&
            (typeof pageId === "number" ? entry.pageId === pageId : true),
        );

      let match = findMatch();
      while (!match && Date.now() - start < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        match = findMatch();
      }

      if (!match) {
        throw new Error(`Timeout waiting for download (${timeout}ms).`);
      }

      if (!shouldPeek) {
        match.consumed = true;
      }

      return respond({
        status: "download-ready",
        downloadId: match.downloadId,
        pageId: match.pageId,
        suggestedFilename: match.suggestedFilename,
        url: match.url,
        mimeType: match.mimeType,
        createdAt: match.createdAt,
        consumed: match.consumed,
      });
    },
  );

  server.registerTool(
    "browser.save_download",
    {
      description:
        "Save a captured download to a path (restricted by MCP path rules).",
      inputSchema: {
        downloadId: z.string(),
        path: z.string(),
      },
    },
    async ({ downloadId, path: targetPath }) => {
      const entry = state.downloadById.get(downloadId);
      if (!entry) {
        throw new Error(`Unknown downloadId "${downloadId}".`);
      }
      const absPath = await assertAllowedWritePath(targetPath);
      await ensureDir(absPath);
      await entry._download.saveAs(absPath);
      entry.savedPath = absPath;
      return respond({
        status: "saved",
        downloadId: entry.downloadId,
        path: absPath,
        suggestedFilename: entry.suggestedFilename,
      });
    },
  );

  server.registerTool(
    "browser.wait_for_popup",
    {
      description: "Wait for a popup/new tab opened by page actions.",
      inputSchema: {
        timeoutMs: z.number().optional(),
        openerPageId: z.number().optional(),
        peek: z.boolean().optional(),
        select: z.boolean().optional(),
      },
    },
    async ({ timeoutMs, openerPageId, peek, select }) => {
      const timeout = clampNumber(timeoutMs, 1000, 300000, 30000);
      const shouldPeek = peek ?? false;
      const shouldSelect = select ?? false;
      const start = Date.now();

      const findMatch = () =>
        state.popups.find(
          (entry) =>
            !entry.consumed &&
            (typeof openerPageId === "number"
              ? entry.openerPageId === openerPageId
              : true),
        );

      let match = findMatch();
      while (!match && Date.now() - start < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        match = findMatch();
      }

      if (!match) {
        throw new Error(`Timeout waiting for popup (${timeout}ms).`);
      }

      if (!shouldPeek) {
        match.consumed = true;
      }

      let selected = false;
      if (shouldSelect && typeof match.pageId === "number") {
        try {
          const popupPage = state.pageManager.selectPage(match.pageId);
          state.page = popupPage;
          selected = true;
        } catch {
          // keep metadata-only response if popup already closed
        }
      }

      return respond({
        status: "popup-ready",
        popupId: match.popupId,
        openerPageId: match.openerPageId,
        pageId: match.pageId,
        url: match.url,
        createdAt: match.createdAt,
        consumed: match.consumed,
        selected,
      });
    },
  );

  server.registerTool(
    "browser.expect_event",
    {
      description:
        "Wait for a specific browser event, optionally running an allowlisted action first.",
      inputSchema: {
        eventType: z.enum([
          "navigation",
          "popup",
          "download",
          "response",
          "request",
        ]),
        pattern: z.string().optional(),
        regex: z.boolean().optional(),
        status: z.number().optional(),
        method: z.string().optional(),
        timeoutMs: z.number().optional(),
        selectPopup: z.boolean().optional(),
        afterAction: z
          .object({
            toolName: z.string(),
            args: z.record(z.string(), z.any()).optional(),
          })
          .optional(),
      },
    },
    async ({
      eventType,
      pattern,
      regex,
      status,
      method,
      timeoutMs,
      selectPopup,
      afterAction,
    }) => {
      const page = ensurePage();
      const timeout = clampNumber(timeoutMs, 1000, 300000, 30000);
      const matchesUrl = buildUrlMatcher(pattern, regex ?? false);

      let waitPromise;
      if (eventType === "navigation") {
        if (pattern) {
          waitPromise = page.waitForURL(
            (url) => matchesUrl(String(url || "")),
            {
              timeout,
            },
          );
        } else {
          waitPromise = page.waitForNavigation({
            waitUntil: "domcontentloaded",
            timeout,
          });
        }
      } else if (eventType === "popup") {
        // Don't filter on initial URL because many popups start as about:blank then navigate.
        waitPromise = page.waitForEvent("popup", { timeout });
      } else if (eventType === "download") {
        waitPromise = page.waitForEvent("download", {
          timeout,
          predicate: (download) => matchesUrl(download.url()),
        });
      } else if (eventType === "response") {
        waitPromise = page.waitForResponse(
          (response) =>
            matchesUrl(response.url()) &&
            (typeof status === "number" ? response.status() === status : true),
          { timeout },
        );
      } else {
        const methodNeedle = String(method || "").toLowerCase();
        waitPromise = page.waitForRequest(
          (request) =>
            matchesUrl(request.url()) &&
            (methodNeedle
              ? request.method().toLowerCase() === methodNeedle
              : true),
          { timeout },
        );
      }

      let afterActionResult;
      try {
        afterActionResult = await runExpectAfterAction(page, afterAction);
      } catch (error) {
        // Prevent background wait rejections when action fails.
        void waitPromise.catch(() => {});
        throw error;
      }
      const event = await waitPromise;

      if (eventType === "navigation") {
        const payload = {
          status: "event-matched",
          eventType,
          url: page.url(),
          responseStatus:
            typeof event?.status === "function" ? event.status() : null,
          afterAction: afterActionResult,
        };
        return respond(
          afterActionResult.frameId
            ? withToolMeta(payload, { frameId: afterActionResult.frameId })
            : withFrameMeta(page, page.mainFrame(), payload),
        );
      }

      if (eventType === "popup") {
        const popupPage = event;
        if (pattern) {
          await popupPage.waitForURL((url) => matchesUrl(String(url || "")), {
            timeout,
          });
        }
        state.pageManager.attachPage(popupPage);
        await ensurePageEventListeners(popupPage);
        await ensureObservability(popupPage);
        const popupPageId = getPageIdSafe(popupPage);
        const shouldSelectPopup = selectPopup ?? false;
        let selectedPopup = false;
        if (shouldSelectPopup && typeof popupPageId === "number") {
          try {
            state.page = state.pageManager.selectPage(popupPageId);
            selectedPopup = true;
          } catch {
            // ignore if popup already closed
          }
        }
        const popupRecord = [...state.popups]
          .reverse()
          .find((item) => item.pageId === popupPageId && !item.consumed);
        if (popupRecord) popupRecord.consumed = true;

        const payload = {
          status: "event-matched",
          eventType,
          popupId: popupRecord?.popupId || null,
          openerPageId: popupRecord?.openerPageId ?? getPageIdSafe(page),
          pageId: popupPageId,
          url: popupPage.url(),
          selected: selectedPopup,
          afterAction: afterActionResult,
        };
        return respond(withFrameMeta(page, page.mainFrame(), payload));
      }

      if (eventType === "download") {
        const download = event;
        let entry = [...state.downloadById.values()].find(
          (item) => item._download === download,
        );
        if (!entry) {
          state.downloadSeq += 1;
          const downloadId = `dl-${state.downloadSeq}`;
          entry = {
            downloadId,
            pageId: getPageIdSafe(page),
            suggestedFilename: String(download.suggestedFilename?.() || ""),
            url: String(download.url?.() || ""),
            mimeType: null,
            createdAt: new Date().toISOString(),
            consumed: false,
            savedPath: null,
            _download: download,
          };
          state.downloadById.set(downloadId, entry);
          const dropped = pushBounded(state.downloads, entry, 400);
          for (const stale of dropped) {
            if (stale?.downloadId) state.downloadById.delete(stale.downloadId);
          }
        }
        const payload = {
          status: "event-matched",
          eventType,
          downloadId: entry.downloadId,
          pageId: entry.pageId,
          suggestedFilename: entry.suggestedFilename,
          url: entry.url,
          mimeType: entry.mimeType,
          afterAction: afterActionResult,
        };
        return respond(withFrameMeta(page, page.mainFrame(), payload));
      }

      if (eventType === "response") {
        const payload = {
          status: "event-matched",
          eventType,
          url: event.url(),
          method: event.request().method(),
          statusCode: event.status(),
          ok: event.ok(),
          afterAction: afterActionResult,
        };
        return respond(withFrameMeta(page, page.mainFrame(), payload));
      }

      const payload = {
        status: "event-matched",
        eventType,
        url: event.url(),
        method: event.method(),
        resourceType: event.resourceType(),
        afterAction: afterActionResult,
      };
      return respond(withFrameMeta(page, page.mainFrame(), payload));
    },
  );
}
