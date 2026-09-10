// Tool definitions and handlers; policy/transport enforcement is centralized.
export function registerNavigationTools(
  server,
  {
    clampNumber,
    clearElementCache,
    ensurePage,
    getBackendNodeIdForUid,
    getFrameScope,
    resolveFrame,
    respond,
    state,
    waitForBackendNode,
    waitForSelector,
    waitForText,
    withFrameMeta,
    z,
  },
) {
  server.registerTool(
    "browser.goto",
    {
      description: "Navigate to a URL.",
      inputSchema: {
        url: z.string(),
        waitUntil: z.string().optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({ url, waitUntil, timeoutMs }) => {
      const page = ensurePage();
      await page.goto(url, {
        waitUntil: waitUntil || "domcontentloaded",
        timeout: timeoutMs || 30000,
      });
      state.uidMaps.delete(page);
      clearElementCache();
      return respond({
        url: page.url(),
        title: await page.title(),
      });
    },
  );

  server.registerTool(
    "browser.back",
    {
      description: "Go back in history.",
      inputSchema: {
        waitUntil: z.string().optional(),
      },
    },
    async ({ waitUntil }) => {
      const page = ensurePage();
      await page.goBack({ waitUntil: waitUntil || "domcontentloaded" });
      state.uidMaps.delete(page);
      clearElementCache();
      return respond({ url: page.url(), title: await page.title() });
    },
  );

  server.registerTool(
    "browser.forward",
    {
      description: "Go forward in history.",
      inputSchema: {
        waitUntil: z.string().optional(),
      },
    },
    async ({ waitUntil }) => {
      const page = ensurePage();
      await page.goForward({ waitUntil: waitUntil || "domcontentloaded" });
      state.uidMaps.delete(page);
      clearElementCache();
      return respond({ url: page.url(), title: await page.title() });
    },
  );

  server.registerTool(
    "browser.reload",
    {
      description: "Reload the current page.",
      inputSchema: {
        waitUntil: z.string().optional(),
        timeoutMs: z.number().optional(),
      },
    },
    async ({ waitUntil, timeoutMs }) => {
      const page = ensurePage();
      const frame = page.mainFrame();
      await page.reload({
        waitUntil: waitUntil || "domcontentloaded",
        timeout: clampNumber(timeoutMs, 1000, 300000, 30000),
      });
      state.uidMaps.delete(page);
      clearElementCache();
      return respond(
        withFrameMeta(page, frame, {
          status: "reloaded",
          url: page.url(),
          title: await page.title(),
        }),
      );
    },
  );

  server.registerTool(
    "browser.wait",
    {
      description: "Wait for a selector or timeout.",
      inputSchema: {
        selector: z.string().optional(),
        timeoutMs: z.number().optional(),
        ms: z.number().optional(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
      },
    },
    async ({ selector, timeoutMs, ms, frameId, frameSelector }) => {
      const page = ensurePage();
      const frame = await resolveFrame(page, {
        frameId,
        frameSelector,
        timeoutMs,
      });
      const scope = getFrameScope(page, frame);
      if (selector) {
        await scope.waitForSelector(selector, { timeout: timeoutMs || 15000 });
        return respond(
          withFrameMeta(page, frame, { status: "selector-ready", selector }),
        );
      }
      if (typeof ms === "number") {
        await page.waitForTimeout(ms);
        return respond(withFrameMeta(page, frame, { status: "waited", ms }));
      }
      return respond(withFrameMeta(page, frame, { status: "no-op" }));
    },
  );

  server.registerTool(
    "browser.wait_for",
    {
      description:
        "Wait for a selector, text, or uid to be ready. Prefer this over fixed sleeps.",
      inputSchema: {
        selector: z.string().optional(),
        text: z.string().optional(),
        exact: z.boolean().optional(),
        uid: z.string().optional(),
        timeoutMs: z.number().optional(),
        state: z
          .enum(["attached", "visible", "hidden", "detached", "enabled"])
          .optional(),
        frameId: z.string().optional(),
        frameSelector: z.string().optional(),
      },
    },
    async ({
      selector,
      text,
      exact,
      uid,
      timeoutMs,
      state,
      frameId,
      frameSelector,
    }) => {
      const page = ensurePage();
      const frame = await resolveFrame(page, {
        frameId,
        frameSelector,
        timeoutMs,
      });
      const resolvedTimeout = clampNumber(timeoutMs, 1000, 300000, 15000);
      const resolvedState = state || "visible";

      const modes = [Boolean(selector), Boolean(text), Boolean(uid)].filter(
        Boolean,
      ).length;
      if (modes !== 1) {
        throw new Error("Provide exactly one of selector, text, or uid.");
      }

      if (selector) {
        let result;
        if (frame === page.mainFrame()) {
          result = await waitForSelector(page, selector, {
            timeoutMs: resolvedTimeout,
            state: resolvedState,
          });
        } else if (resolvedState === "enabled") {
          const locator = frame.locator(selector).first();
          await locator.waitFor({ state: "visible", timeout: resolvedTimeout });
          const start = Date.now();
          while (Date.now() - start < resolvedTimeout) {
            try {
              if (await locator.isEnabled()) {
                result = {
                  status: "ready",
                  kind: "selector",
                  selector,
                  state: "enabled",
                };
                break;
              }
            } catch {
              // retry
            }
            await page.waitForTimeout(100);
          }
          if (!result)
            throw new Error(
              `Timeout waiting for selector "${selector}" to become enabled (${resolvedTimeout}ms).`,
            );
        } else {
          await frame.waitForSelector(selector, {
            timeout: resolvedTimeout,
            state: resolvedState,
          });
          result = {
            status: "ready",
            kind: "selector",
            selector,
            state: resolvedState,
          };
        }
        return respond(withFrameMeta(page, frame, result));
      }

      if (text) {
        let result;
        if (frame === page.mainFrame()) {
          result = await waitForText(page, text, {
            timeoutMs: resolvedTimeout,
            state: resolvedState,
            exact: exact ?? false,
          });
        } else {
          const locator = frame
            .getByText(text, { exact: exact ?? false })
            .first();
          if (resolvedState === "enabled") {
            await locator.waitFor({
              state: "visible",
              timeout: resolvedTimeout,
            });
            const start = Date.now();
            while (Date.now() - start < resolvedTimeout) {
              try {
                if (await locator.isEnabled()) {
                  result = {
                    status: "ready",
                    kind: "text",
                    text,
                    exact: exact ?? false,
                    state: "enabled",
                  };
                  break;
                }
              } catch {
                // retry
              }
              await page.waitForTimeout(100);
            }
            if (!result)
              throw new Error(
                `Timeout waiting for text "${text}" to become enabled (${resolvedTimeout}ms).`,
              );
          } else {
            await locator.waitFor({
              state: resolvedState,
              timeout: resolvedTimeout,
            });
            result = {
              status: "ready",
              kind: "text",
              text,
              exact: exact ?? false,
              state: resolvedState,
            };
          }
        }
        return respond(withFrameMeta(page, frame, result));
      }

      const backendNodeId = getBackendNodeIdForUid(page, uid, frame);
      const result = await waitForBackendNode(page, backendNodeId, {
        timeoutMs: resolvedTimeout,
      });
      return respond(withFrameMeta(page, frame, { ...result, uid }));
    },
  );
}
