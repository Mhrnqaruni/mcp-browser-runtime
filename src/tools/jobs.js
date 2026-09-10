// Tool definitions and handlers; policy/transport enforcement is centralized.
export function registerJobsTools(
  server,
  {
    assertAllowedWritePath,
    clearElementCache,
    clickIndeedNextPage,
    detectIndeedAccessIssue,
    ensurePage,
    extractIndeedJobs,
    respond,
    saveJobsToTxt,
    z,
  },
) {
  server.registerTool(
    "jobs.extract_indeed",
    {
      description:
        "Extract jobs from an Indeed search results page. Optionally save each job to a .txt file.",
      inputSchema: {
        limit: z.number().optional(),
        saveDir: z.string().optional(),
      },
    },
    async ({ limit, saveDir }) => {
      const page = ensurePage();
      const access = await detectIndeedAccessIssue(page);
      if (access.blocked || access.authRequired) {
        return respond({
          blocked: access.blocked,
          authRequired: access.authRequired,
          message:
            access.message ||
            "The service blocked this request. Stop automation and use an authorized access method; do not bypass the restriction.",
        });
      }
      const jobs = await extractIndeedJobs(page, { limit: limit || 20 });
      const result = { count: jobs.length, jobs };

      if (saveDir) {
        const absDir = await assertAllowedWritePath(saveDir);
        const saved = await saveJobsToTxt(jobs, absDir);
        return respond({ ...result, saved });
      }

      return respond(result);
    },
  );

  server.registerTool(
    "jobs.indeed_next_page",
    {
      description:
        "Go to the next Indeed results page (direct URL by default, with optional click mode).",
      inputSchema: {
        mode: z.enum(["direct", "click", "auto"]).optional(),
      },
    },
    async ({ mode }) => {
      const page = ensurePage();
      const navigationMode = mode || "direct";

      const tryDirect = async () => {
        const currentUrl = new URL(page.url());
        const currentStart = Number.parseInt(
          currentUrl.searchParams.get("start") || "0",
          10,
        );
        const nextStart = Number.isNaN(currentStart) ? 10 : currentStart + 10;
        currentUrl.searchParams.set("start", String(nextStart));
        await page.goto(currentUrl.toString(), {
          waitUntil: "domcontentloaded",
        });
        clearElementCache();
        return respond({
          clicked: false,
          navigated: true,
          url: page.url(),
          start: nextStart,
        });
      };

      const tryClick = async () => {
        const clicked = await clickIndeedNextPage(page);
        if (clicked) {
          await page.waitForLoadState("domcontentloaded");
          clearElementCache();
          return respond({ clicked, url: page.url() });
        }
        return null;
      };

      if (navigationMode === "direct") {
        return await tryDirect();
      }

      if (navigationMode === "click") {
        const result = await tryClick();
        if (result) return result;
        return respond({ clicked: false, navigated: false, url: page.url() });
      }

      // auto: direct first, then click
      try {
        return await tryDirect();
      } catch {
        const result = await tryClick();
        if (result) return result;
        return respond({ clicked: false, navigated: false, url: page.url() });
      }
    },
  );
}
