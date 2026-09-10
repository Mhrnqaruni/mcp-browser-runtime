// Tool definitions and handlers; policy/transport enforcement is centralized.
export function registerSessionTools(
  server,
  {
    DEFAULT_VIEWPORT,
    assertAllowedReadPath,
    assertAllowedWritePath,
    ensureDir,
    ensureObservability,
    ensurePageEventListeners,
    fs,
    resetCaptureProfileToDefault,
    resetRuntimeQueues,
    respond,
    state,
    z,
  },
) {
  server.registerTool(
    "browser.get_cookies",
    {
      description: "Get cookies from the current browser context.",
      inputSchema: {
        urls: z.array(z.string()).optional(),
      },
    },
    async ({ urls }) => {
      if (!state.context) {
        throw new Error(
          "Browser context is not available. Launch or connect first.",
        );
      }
      const cookies = await state.context.cookies(
        Array.isArray(urls) && urls.length ? urls : undefined,
      );
      return respond({ count: cookies.length, cookies });
    },
  );

  server.registerTool(
    "browser.set_cookies",
    {
      description: "Set cookies in the current browser context.",
      inputSchema: {
        cookies: z.array(
          z.object({
            name: z.string(),
            value: z.string(),
            url: z.string().optional(),
            domain: z.string().optional(),
            path: z.string().optional(),
            expires: z.number().optional(),
            httpOnly: z.boolean().optional(),
            secure: z.boolean().optional(),
            sameSite: z.enum(["Strict", "Lax", "None"]).optional(),
          }),
        ),
      },
    },
    async ({ cookies }) => {
      if (!state.context) {
        throw new Error(
          "Browser context is not available. Launch or connect first.",
        );
      }
      for (const cookie of cookies) {
        if (!cookie.url && (!cookie.domain || !cookie.path)) {
          throw new Error(
            `Cookie "${cookie.name}" must include either url, or both domain and path.`,
          );
        }
      }
      await state.context.addCookies(cookies);
      return respond({ status: "cookies-set", count: cookies.length });
    },
  );

  server.registerTool(
    "browser.clear_cookies",
    {
      description: "Clear all cookies in the current browser context.",
      inputSchema: {},
    },
    async () => {
      if (!state.context) {
        throw new Error(
          "Browser context is not available. Launch or connect first.",
        );
      }
      const before = (await state.context.cookies()).length;
      await state.context.clearCookies();
      const after = (await state.context.cookies()).length;
      return respond({ status: "cookies-cleared", before, after });
    },
  );

  server.registerTool(
    "browser.export_storage_state",
    {
      description: "Export browser storage state. Optionally save to a path.",
      inputSchema: {
        path: z.string().optional(),
        includeData: z.boolean().optional(),
      },
    },
    async ({ path: targetPath, includeData }) => {
      if (!state.context) {
        throw new Error(
          "Browser context is not available. Launch or connect first.",
        );
      }
      const storageState = await state.context.storageState();
      let absPath = null;
      if (targetPath) {
        absPath = await assertAllowedWritePath(targetPath);
        await ensureDir(absPath);
        await fs.writeFile(
          absPath,
          JSON.stringify(storageState, null, 2),
          "utf8",
        );
      }

      const payload = {
        status: "storage-exported",
        path: absPath,
        cookies: storageState.cookies.length,
        origins: storageState.origins.length,
      };
      if (includeData ?? false) {
        payload.storageState = storageState;
      }
      return respond(payload);
    },
  );

  server.registerTool(
    "browser.import_storage_state",
    {
      description:
        "Import storage state by creating and selecting a new browser context.",
      inputSchema: {
        path: z.string(),
        closePreviousContext: z.boolean().optional(),
      },
    },
    async ({ path: sourcePath, closePreviousContext }) => {
      if (!state.browser) {
        throw new Error("Browser is not available. Launch or connect first.");
      }
      const absPath = await assertAllowedReadPath(sourcePath);
      const previousContext = state.context;

      const newContext = await state.browser.newContext({
        storageState: absPath,
        viewport: DEFAULT_VIEWPORT,
      });
      state.context = newContext;
      state.pageManager.reset();
      resetRuntimeQueues();
      resetCaptureProfileToDefault();
      await state.pageManager.attachContext(newContext);
      state.page = state.pageManager.getActivePage();
      try {
        for (const p of newContext.pages()) {
          await ensureObservability(p);
          await ensurePageEventListeners(p);
        }
      } catch {
        // best effort
      }

      let closedPrevious = false;
      let warning = null;
      if (
        closePreviousContext &&
        previousContext &&
        previousContext !== newContext
      ) {
        if (state.persistent) {
          warning =
            "Skipped closing previous context in persistent mode to avoid terminating the browser.";
        } else {
          try {
            await previousContext.close();
            closedPrevious = true;
          } catch {
            warning =
              "Failed to close previous context; continuing with the new imported context.";
          }
        }
      }

      return respond({
        status: "storage-imported",
        mode: "new-context",
        path: absPath,
        pages: newContext.pages().length,
        activePageId: state.pageManager.getActivePageId(),
        closedPrevious,
        warning,
      });
    },
  );
}
