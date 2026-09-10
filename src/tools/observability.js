// Tool definitions and handlers; policy/transport enforcement is centralized.
export function registerObservabilityTools(
  server,
  {
    assertAllowedWritePath,
    ensureDir,
    ensurePage,
    fs,
    getNetworkRequest,
    listConsoleMessages,
    listNetworkRequests,
    respond,
    z,
  },
) {
  server.registerTool(
    "browser.list_console_messages",
    {
      description: "List recent console logs and exceptions captured via CDP.",
      inputSchema: {
        limit: z.number().optional(),
      },
    },
    async ({ limit }) => {
      const page = ensurePage();
      const payload = await listConsoleMessages(page, { limit });
      return respond({ count: payload.length, messages: payload });
    },
  );

  server.registerTool(
    "browser.list_network_requests",
    {
      description: "List recent network requests captured via CDP.",
      inputSchema: {
        limit: z.number().optional(),
        urlContains: z.string().optional(),
      },
    },
    async ({ limit, urlContains }) => {
      const page = ensurePage();
      const payload = await listNetworkRequests(page, { limit, urlContains });
      return respond({ count: payload.length, requests: payload });
    },
  );

  server.registerTool(
    "browser.get_network_request",
    {
      description:
        "Get details for a captured network request (optionally includes response body).",
      inputSchema: {
        requestId: z.string(),
        includeBody: z.boolean().optional(),
        maxBodyChars: z.number().optional(),
        saveBodyPath: z.string().optional(),
      },
    },
    async ({ requestId, includeBody, maxBodyChars, saveBodyPath }) => {
      const page = ensurePage();
      const payload = await getNetworkRequest(page, requestId, {
        includeBody,
        maxBodyChars,
      });

      if (saveBodyPath && payload.body !== null) {
        const abs = await assertAllowedWritePath(saveBodyPath);
        await ensureDir(abs);
        await fs.writeFile(abs, String(payload.body), "utf8");
        payload.bodySavedTo = abs;
      }

      return respond(payload);
    },
  );
}
