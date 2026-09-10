// Tool definitions and handlers; policy/transport enforcement is centralized.
export function registerLifecycleTools(
  server,
  {
    DEFAULT_VIEWPORT,
    ENV_DEFAULTS,
    buildArgs,
    chromium,
    clampNumber,
    clearElementCache,
    ensureDomTracker,
    ensureObservability,
    ensurePage,
    ensurePageEventListeners,
    hasDefaultChromeUserDataDir,
    listDomFrames,
    normalizeProfilePath,
    path,
    resetCaptureProfileToDefault,
    resetRuntimeQueues,
    resolveChromePath,
    respond,
    spawn,
    state,
    withFrameMeta,
    z,
  },
) {
  server.registerTool(
    "browser.launch",
    {
      description: "Launch Chromium with Playwright and open a new page.",
      inputSchema: {
        headless: z.boolean().optional(),
        slowMoMs: z.number().optional(),
        args: z.array(z.string()).optional(),
        stealth: z.boolean().optional(),
        channel: z.string().optional(),
        executablePath: z.string().optional(),
        profileDirectory: z.string().optional(),
        viewport: z
          .object({
            width: z.number(),
            height: z.number(),
          })
          .optional(),
        userAgent: z.string().optional(),
        userDataDir: z.string().optional(),
      },
    },
    async ({
      headless,
      slowMoMs,
      viewport,
      userAgent,
      userDataDir,
      args,
      stealth,
      channel,
      executablePath,
      profileDirectory,
    }) => {
      if (ENV_DEFAULTS.forceCdp) {
        throw new Error(
          "browser.launch is disabled in CDP mode. Use browser.launch_chrome_cdp instead.",
        );
      }
      const resolvedHeadless = headless ?? ENV_DEFAULTS.headless ?? false;
      const resolvedSlowMoMs = slowMoMs ?? ENV_DEFAULTS.slowMoMs ?? 0;
      const resolvedArgs = args ?? ENV_DEFAULTS.args ?? [];
      const resolvedStealth = stealth ?? ENV_DEFAULTS.stealth ?? false;
      const resolvedChannel = channel ?? ENV_DEFAULTS.channel;
      const resolvedExecutablePath =
        executablePath ?? ENV_DEFAULTS.executablePath;
      const resolvedUserDataDir = userDataDir ?? ENV_DEFAULTS.userDataDir;
      const resolvedProfileDirectory =
        profileDirectory ?? ENV_DEFAULTS.profileDirectory;
      const normalized = normalizeProfilePath(
        resolvedUserDataDir,
        resolvedProfileDirectory,
      );
      const normalizedUserDataDir = normalized.userDataDir;
      const normalizedProfileDirectory = normalized.profileDirectory;

      if (resolvedChannel && resolvedExecutablePath) {
        throw new Error("Provide either channel or executablePath, not both.");
      }
      if (ENV_DEFAULTS.requireProfile && !normalizedUserDataDir) {
        throw new Error(
          "Profile launch required but no userDataDir was provided. Check MCP_USER_DATA_DIR.",
        );
      }
      if (normalizedProfileDirectory && !normalizedUserDataDir) {
        throw new Error(
          "profileDirectory requires userDataDir (persistent context).",
        );
      }
      if (
        normalizedUserDataDir &&
        hasDefaultChromeUserDataDir(normalizedUserDataDir) &&
        (resolvedChannel || resolvedExecutablePath)
      ) {
        throw new Error(
          'Chrome blocks automation on the default "User Data" directory (Chrome 136+). Use a dedicated userDataDir (e.g. ChromeForMCP) or browser.launch_chrome_cdp.',
        );
      }
      if (state.context) {
        await state.context.close();
      } else if (state.browser) {
        await state.browser.close();
      }
      state.browser = null;
      state.context = null;
      state.page = null;
      state.persistent = false;
      state.cdpConnected = false;
      state.cdpManaged = false;
      state.cdpAutoClose = false;
      state.chromeProcess = null;
      state.pageManager.reset();
      resetRuntimeQueues();
      resetCaptureProfileToDefault();

      const launchArgs = buildArgs(resolvedArgs, normalizedProfileDirectory);
      state.lastLaunch = {
        headless: resolvedHeadless,
        slowMoMs: resolvedSlowMoMs,
        args: launchArgs,
        stealth: resolvedStealth,
        channel: resolvedChannel || null,
        executablePath: resolvedExecutablePath || null,
        userDataDir: normalizedUserDataDir || null,
        profileDirectory: normalizedProfileDirectory || null,
        userAgent: userAgent || null,
        viewport: viewport ?? DEFAULT_VIEWPORT,
      };
      if (normalizedUserDataDir) {
        state.context = await chromium.launchPersistentContext(
          normalizedUserDataDir,
          {
            headless: resolvedHeadless,
            slowMo: resolvedSlowMoMs,
            viewport: viewport ?? DEFAULT_VIEWPORT,
            userAgent: userAgent || undefined,
            args: launchArgs,
            channel: resolvedChannel || undefined,
            executablePath: resolvedExecutablePath || undefined,
          },
        );
        state.browser = state.context.browser();
        state.persistent = true;
      } else {
        state.browser = await chromium.launch({
          headless: resolvedHeadless,
          slowMo: resolvedSlowMoMs,
          args: launchArgs,
          channel: resolvedChannel || undefined,
          executablePath: resolvedExecutablePath || undefined,
        });

        state.context = await state.browser.newContext({
          viewport: viewport ?? DEFAULT_VIEWPORT,
          userAgent: userAgent || undefined,
        });
      }

      if (resolvedStealth) {
        await state.context.addInitScript(() => {
          Object.defineProperty(navigator, "webdriver", {
            get: () => undefined,
          });
          Object.defineProperty(navigator, "languages", {
            get: () => ["en-US", "en"],
          });
          Object.defineProperty(navigator, "platform", { get: () => "Win32" });
        });
      }

      const prePages = state.context.pages();
      await state.pageManager.attachContext(state.context);
      state.page = state.pageManager.getActivePage();
      if (resolvedStealth && prePages.length) {
        await state.page.reload({ waitUntil: "domcontentloaded" });
      }
      // Attach CDP listeners early so console/network logs are available later for debugging.
      try {
        for (const p of state.context.pages()) {
          await ensureObservability(p);
          await ensurePageEventListeners(p);
        }
      } catch {
        // best effort
      }

      const warnings = [];
      warnings.push(...normalized.warnings);
      if (
        normalizedUserDataDir &&
        hasDefaultChromeUserDataDir(normalizedUserDataDir)
      ) {
        warnings.push(
          'Using default Chrome "User Data" may be locked if Chrome is open. Prefer a dedicated profile directory.',
        );
      }

      const browserVersion = state.browser ? state.browser.version() : null;

      return respond({
        status: "launched",
        headless: resolvedHeadless,
        viewport: viewport ?? DEFAULT_VIEWPORT,
        persistent: state.persistent,
        browserVersion,
        channel: resolvedChannel || null,
        executablePath: resolvedExecutablePath || null,
        userDataDir: normalizedUserDataDir || null,
        profileDirectory: normalizedProfileDirectory || null,
        args: launchArgs,
        warnings,
      });
    },
  );

  server.registerTool(
    "browser.connect_cdp",
    {
      description:
        "Connect to an existing Chrome/Chromium with remote debugging enabled (CDP).",
      inputSchema: {
        endpoint: z.string().optional(),
        slowMoMs: z.number().optional(),
      },
    },
    async ({ endpoint, slowMoMs }) => {
      const resolvedEndpoint =
        endpoint ||
        ENV_DEFAULTS.cdpEndpoint ||
        (ENV_DEFAULTS.cdpPort
          ? `http://127.0.0.1:${ENV_DEFAULTS.cdpPort}`
          : null);
      const url = resolvedEndpoint || "http://127.0.0.1:9222";
      if (state.context) {
        await state.context.close();
      } else if (state.browser) {
        await state.browser.close();
      }

      state.browser = await chromium.connectOverCDP(url, {
        slowMo: slowMoMs ?? ENV_DEFAULTS.slowMoMs ?? 0,
      });
      const contexts = state.browser.contexts();
      state.context = contexts.length
        ? contexts[0]
        : await state.browser.newContext();
      resetRuntimeQueues();
      resetCaptureProfileToDefault();
      state.pageManager.reset();
      await state.pageManager.attachContext(state.context);
      state.page = state.pageManager.getActivePage();
      try {
        for (const p of state.context.pages()) {
          await ensureObservability(p);
          await ensurePageEventListeners(p);
        }
      } catch {
        // best effort
      }
      state.persistent = true;
      state.cdpConnected = true;
      state.cdpManaged = false;
      state.cdpAutoClose = false;
      state.chromeProcess = null;
      return respond({
        status: "connected",
        endpoint: url,
        pages: state.context.pages().length,
      });
    },
  );

  server.registerTool(
    "browser.launch_chrome_cdp",
    {
      description:
        "Launch Chrome with remote debugging enabled and connect via CDP.",
      inputSchema: {
        chromePath: z.string().optional(),
        userDataDir: z.string().optional(),
        profileDirectory: z.string().optional(),
        port: z.number().optional(),
        args: z.array(z.string()).optional(),
        headless: z.boolean().optional(),
        slowMoMs: z.number().optional(),
        stealth: z.boolean().optional(),
        waitMs: z.number().optional(),
        autoClose: z.boolean().optional(),
      },
    },
    async ({
      chromePath,
      userDataDir,
      profileDirectory,
      port,
      args,
      headless,
      slowMoMs,
      stealth,
      waitMs,
      autoClose,
    }) => {
      const resolvedChromePath = chromePath ?? ENV_DEFAULTS.chromePath;
      const resolvedUserDataDir = userDataDir ?? ENV_DEFAULTS.userDataDir;
      const resolvedProfileDirectory =
        profileDirectory ?? ENV_DEFAULTS.profileDirectory;
      const normalized = normalizeProfilePath(
        resolvedUserDataDir,
        resolvedProfileDirectory,
      );
      const normalizedUserDataDir = normalized.userDataDir;
      const normalizedProfileDirectory = normalized.profileDirectory;
      const resolvedPort = port ?? ENV_DEFAULTS.cdpPort ?? 9222;
      const resolvedArgs = args ?? ENV_DEFAULTS.args ?? [];
      const resolvedHeadless = headless ?? ENV_DEFAULTS.headless ?? false;
      const resolvedSlowMoMs = slowMoMs ?? ENV_DEFAULTS.slowMoMs ?? 0;
      const resolvedStealth = stealth ?? ENV_DEFAULTS.stealth ?? false;
      const resolvedWaitMs = waitMs ?? ENV_DEFAULTS.cdpWaitMs ?? 20000;
      const resolvedAutoClose = autoClose ?? ENV_DEFAULTS.cdpAutoClose ?? false;

      if (normalizedProfileDirectory && !normalizedUserDataDir) {
        throw new Error("profileDirectory requires userDataDir.");
      }
      if (
        normalizedUserDataDir &&
        hasDefaultChromeUserDataDir(normalizedUserDataDir)
      ) {
        throw new Error(
          'Chrome blocks CDP automation on the default "User Data" directory (Chrome 136+). Use a dedicated userDataDir (e.g. ChromeForMCP).',
        );
      }
      if (state.context) {
        await state.context.close();
      } else if (state.browser) {
        await state.browser.close();
      }

      const resolvedChrome = await resolveChromePath(resolvedChromePath);
      if (!resolvedChrome) {
        throw new Error(
          "Unable to locate chrome.exe. Provide chromePath explicitly.",
        );
      }

      const cdpPort = resolvedPort;
      const dataDir =
        normalizedUserDataDir ||
        path.join(process.env["LOCALAPPDATA"] || process.cwd(), "ChromeForMCP");
      const launchArgs = buildArgs(resolvedArgs, normalizedProfileDirectory);
      if (
        !launchArgs.some((arg) => arg.startsWith("--remote-debugging-port="))
      ) {
        launchArgs.push(`--remote-debugging-port=${cdpPort}`);
      }
      if (!launchArgs.some((arg) => arg.startsWith("--user-data-dir="))) {
        launchArgs.push(`--user-data-dir=${dataDir}`);
      }
      if (!resolvedHeadless) {
        const hasNewWindow = launchArgs.some((arg) => arg === "--new-window");
        const hasWindowSize = launchArgs.some((arg) =>
          arg.startsWith("--window-size="),
        );
        const hasStartMax = launchArgs.some(
          (arg) => arg === "--start-maximized",
        );
        if (!hasNewWindow) {
          launchArgs.push("--new-window");
        }
        if (!hasWindowSize && !hasStartMax) {
          launchArgs.push("--start-maximized");
        }
      }
      if (resolvedHeadless) {
        if (!launchArgs.some((arg) => arg.startsWith("--headless"))) {
          launchArgs.push("--headless=new");
        }
      }

      const chromeProcess = spawn(resolvedChrome, launchArgs, {
        detached: true,
        stdio: "ignore",
      });
      chromeProcess.unref();

      const timeoutMs = resolvedWaitMs;
      const start = Date.now();
      let connected = false;
      let lastError = null;
      while (Date.now() - start < timeoutMs) {
        try {
          state.browser = await chromium.connectOverCDP(
            `http://127.0.0.1:${cdpPort}`,
            { slowMo: resolvedSlowMoMs },
          );
          connected = true;
          break;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      if (!connected) {
        throw new Error(
          `Failed to connect to Chrome CDP on port ${cdpPort}. ${lastError || ""}`.trim(),
        );
      }

      state.chromeProcess = chromeProcess;
      state.cdpConnected = true;
      state.cdpManaged = true;
      state.cdpAutoClose = resolvedAutoClose;
      state.persistent = true;

      const contexts = state.browser.contexts();
      state.context = contexts.length
        ? contexts[0]
        : await state.browser.newContext();
      resetRuntimeQueues();
      resetCaptureProfileToDefault();
      state.pageManager.reset();
      if (resolvedStealth) {
        await state.context.addInitScript(() => {
          Object.defineProperty(navigator, "webdriver", {
            get: () => undefined,
          });
          Object.defineProperty(navigator, "languages", {
            get: () => ["en-US", "en"],
          });
          Object.defineProperty(navigator, "platform", { get: () => "Win32" });
        });
      }
      const prePages = state.context.pages();
      await state.pageManager.attachContext(state.context);
      state.page = state.pageManager.getActivePage();
      if (resolvedStealth && prePages.length) {
        await state.page.reload({ waitUntil: "domcontentloaded" });
      }
      try {
        for (const p of state.context.pages()) {
          await ensureObservability(p);
          await ensurePageEventListeners(p);
        }
      } catch {
        // best effort
      }

      const warnings = [...normalized.warnings];
      if (hasDefaultChromeUserDataDir(dataDir)) {
        warnings.push(
          'Using default Chrome "User Data" with CDP is blocked in recent Chrome versions. Use a dedicated data dir.',
        );
      }

      const browserVersion = state.browser ? state.browser.version() : null;

      return respond({
        status: "launched",
        chromePath: resolvedChrome,
        endpoint: `http://127.0.0.1:${cdpPort}`,
        userDataDir: dataDir,
        persistent: true,
        browserVersion,
        profileDirectory: normalizedProfileDirectory || null,
        args: launchArgs,
        warnings,
      });
    },
  );

  server.registerTool(
    "browser.new_page",
    {
      description: "Open a new page/tab in the current context.",
      inputSchema: {},
    },
    async () => {
      if (!state.context) {
        throw new Error(
          "Browser is not launched. Run browser.launch or browser.connect_cdp first.",
        );
      }
      const page = await state.context.newPage();
      state.pageManager.attachPage(page);
      state.page = page;
      try {
        await ensureObservability(page);
        await ensurePageEventListeners(page);
      } catch {
        // best effort
      }
      clearElementCache();
      return respond({ status: "new-page", url: state.page.url() });
    },
  );

  server.registerTool(
    "browser.list_pages",
    {
      description: "List open pages/tabs in the current context.",
      inputSchema: {
        includeClosed: z.boolean().optional(),
        maxPages: z.number().optional(),
      },
    },
    async ({ includeClosed, maxPages }) => {
      if (!state.context) {
        throw new Error(
          "Browser is not launched. Run browser.launch or browser.connect_cdp first.",
        );
      }
      const allPages = await state.pageManager.listPages();
      const include = includeClosed ?? false;
      const resolvedMaxPages = clampNumber(maxPages, 1, 1000, 200);
      const filtered = allPages.filter((entry) =>
        include ? true : !entry.closed,
      );
      let pages = filtered.slice(0, resolvedMaxPages);
      const activePageId = state.pageManager.getActivePageId();
      if (
        typeof activePageId === "number" &&
        !pages.some((entry) => entry.pageId === activePageId)
      ) {
        const activeEntry = filtered.find(
          (entry) => entry.pageId === activePageId,
        );
        if (activeEntry) {
          if (pages.length >= resolvedMaxPages && pages.length > 0) {
            pages[pages.length - 1] = activeEntry;
          } else {
            pages = [...pages, activeEntry];
          }
        }
      }
      return respond({
        activePageId,
        totalCount: allPages.length,
        count: pages.length,
        pages,
      });
    },
  );

  server.registerTool(
    "browser.list_frames",
    {
      description: "List frames for the active page (or a specified pageId).",
      inputSchema: {
        pageId: z.number().optional(),
      },
    },
    async ({ pageId }) => {
      let page = ensurePage();
      if (typeof pageId === "number") {
        page = state.pageManager.selectPage(pageId);
        state.page = page;
      }
      ensureDomTracker(page);
      const payload = listDomFrames(page);
      return respond(
        withFrameMeta(page, page.mainFrame(), {
          count: payload.frames.length,
          frames: payload.frames,
          pageDomVersion: payload.pageDomVersion,
          domVersion: payload.domVersion,
        }),
      );
    },
  );

  server.registerTool(
    "browser.select_page",
    {
      description: "Select the active page/tab by pageId.",
      inputSchema: {
        pageId: z.number(),
      },
    },
    async ({ pageId }) => {
      if (!state.context) {
        throw new Error(
          "Browser is not launched. Run browser.launch or browser.connect_cdp first.",
        );
      }
      const page = state.pageManager.selectPage(pageId);
      state.page = page;
      try {
        await ensureObservability(page);
        await ensurePageEventListeners(page);
      } catch {
        // best effort
      }
      clearElementCache();
      return respond({ status: "selected", pageId, url: page.url() });
    },
  );

  server.registerTool(
    "browser.close_page",
    {
      description:
        "Close a page/tab by pageId (or the active page if omitted).",
      inputSchema: {
        pageId: z.number().optional(),
      },
    },
    async ({ pageId }) => {
      if (!state.context) {
        throw new Error(
          "Browser is not launched. Run browser.launch or browser.connect_cdp first.",
        );
      }
      const result = await state.pageManager.closePage(pageId);
      state.page = state.pageManager.getActivePage();
      clearElementCache();
      return respond({ status: "closed-page", ...result });
    },
  );

  server.registerTool(
    "browser.close",
    {
      description: "Close the current browser session.",
      inputSchema: {
        terminateChrome: z.boolean().optional(),
      },
    },
    async ({ terminateChrome }) => {
      if (state.cdpConnected) {
        if (state.browser) {
          await state.browser.close();
        }
        if (
          (terminateChrome || state.cdpAutoClose) &&
          state.chromeProcess?.pid
        ) {
          try {
            process.kill(state.chromeProcess.pid);
          } catch {
            // ignore
          }
        }
      } else if (state.context) {
        await state.context.close();
      }
      state.browser = null;
      state.context = null;
      state.page = null;
      state.persistent = false;
      state.cdpConnected = false;
      state.cdpManaged = false;
      state.cdpAutoClose = false;
      state.chromeProcess = null;
      state.lastLaunch = null;
      state.pageManager.reset();
      resetRuntimeQueues();
      resetCaptureProfileToDefault();
      return respond({ status: "closed" });
    },
  );
}
