// Tool definitions and handlers; policy/transport enforcement is centralized.
export function registerSearchTools(
  server,
  {
    assertAllowedWritePath,
    detectGoogleBlocked,
    ensurePage,
    extractGoogleResults,
    respond,
    saveSearchResultsToTxt,
    tryAcceptGoogleConsent,
    z,
  },
) {
  server.registerTool(
    "search.extract_google",
    {
      description:
        "Extract standard Google search results from the current page. Optionally save to .txt files.",
      inputSchema: {
        limit: z.number().optional(),
        saveDir: z.string().optional(),
      },
    },
    async ({ limit, saveDir }) => {
      const page = ensurePage();
      const blocked = await detectGoogleBlocked(page);
      if (blocked) {
        return respond({
          blocked: true,
          message:
            "The service blocked this request. Stop automation and use an authorized access method; do not bypass the restriction.",
        });
      }
      const results = await extractGoogleResults(page, { limit: limit || 10 });
      const payload = { count: results.length, results };

      if (saveDir) {
        const absDir = await assertAllowedWritePath(saveDir);
        const saved = await saveSearchResultsToTxt(results, absDir);
        return respond({ ...payload, saved });
      }

      return respond(payload);
    },
  );

  server.registerTool(
    "search.google",
    {
      description:
        "Search Google and extract results for a query. Optionally save to .txt files.",
      inputSchema: {
        query: z.string(),
        limit: z.number().optional(),
        saveDir: z.string().optional(),
      },
    },
    async ({ query, limit, saveDir }) => {
      const page = ensurePage();
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await tryAcceptGoogleConsent(page);
      const blocked = await detectGoogleBlocked(page);
      if (blocked) {
        return respond({
          blocked: true,
          message:
            "The service blocked this request. Stop automation and use an authorized access method; do not bypass the restriction.",
        });
      }

      const results = await extractGoogleResults(page, { limit: limit || 10 });
      const payload = { query, count: results.length, results };

      if (saveDir) {
        const absDir = await assertAllowedWritePath(saveDir);
        const saved = await saveSearchResultsToTxt(results, absDir);
        return respond({ ...payload, saved });
      }

      return respond(payload);
    },
  );
}
