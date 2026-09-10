import { createFilePolicy } from "../security/paths.js";
import path from "node:path";
import { installNavigationPolicy } from "../security/navigation.js";

export async function executeSessionTool(name, args, state, policy) {
  if (!policy.sessionSecrets || !state.context)
    throw new Error("Session capability or context unavailable");
  if (name === "browser.get_cookies") {
    const cookies = await state.context.cookies(args.urls);
    return {
      count: cookies.length,
      cookies: cookies.map((cookie) =>
        args.includeValues === true
          ? cookie
          : Object.fromEntries(
              Object.entries(cookie).filter(([key]) => key !== "value"),
            ),
      ),
    };
  }
  if (name === "browser.clear_cookies") {
    await state.context.clearCookies();
    return { status: "cookies-cleared" };
  }
  if (name === "browser.set_cookies") {
    for (const cookie of args.cookies) {
      if (cookie.domain || cookie.path)
        throw new Error("Use an exact cookie URL, not domain/path overrides");
      const origin = cookie.url ? new URL(cookie.url).origin : null;
      if (
        !origin ||
        (!policy.origins.includes(origin) &&
          !policy.localOrigins.includes(origin))
      )
        throw new Error("Cookies require an allowed exact URL");
    }
    await state.context.addCookies(args.cookies);
    return { status: "cookies-set", count: args.cookies.length };
  }
  if (
    !policy.authDir ||
    !/^[a-z0-9][a-z0-9-]{0,60}\.json$/.test(args.path ?? "") ||
    args.includeData
  )
    throw new Error(
      "Explicit safe auth filename required; inline state unavailable",
    );
  if (
    path.basename(policy.authDir) !== "auth" ||
    path.basename(path.dirname(policy.authDir)) !== ".mcp-data"
  )
    throw new Error(
      "Auth directory must be an ignored .mcp-data/auth directory",
    );
  const files = await createFilePolicy({
    readRoots: [policy.authDir],
    writeRoots: [policy.authDir],
  });
  if (name === "browser.export_storage_state") {
    const storage = await state.context.storageState();
    await files.writeText(args.path, JSON.stringify(storage));
    return {
      status: "storage-exported",
      file: args.path,
      cookies: storage.cookies.length,
      origins: storage.origins.length,
    };
  }
  const storage = JSON.parse(await files.readText(args.path));
  if (!Array.isArray(storage.cookies) || !Array.isArray(storage.origins))
    throw new Error("Invalid storage format");
  if (
    storage.origins.some(
      (item) =>
        !policy.origins.includes(item.origin) &&
        !policy.localOrigins.includes(item.origin),
    )
  )
    throw new Error("Storage origin denied");
  for (const cookie of storage.cookies) {
    const hosts = [...policy.origins, ...policy.localOrigins].map(
      (origin) => new URL(origin).hostname,
    );
    if (!hosts.includes(cookie.domain?.replace(/^\./, "")))
      throw new Error("Cookie domain denied");
  }
  const previous = state.context;
  const context = await state.browser.newContext({
    storageState: storage,
    serviceWorkers: "block",
    acceptDownloads: false,
  });
  try {
    await installNavigationPolicy(context, policy);
    context.setDefaultTimeout(10000);
    context.setDefaultNavigationTimeout(15000);
    await previous.close();
    state.context = context;
    state.pageManager.reset();
    await state.pageManager.attachContext(context);
    state.page = state.pageManager.getActivePage();
    return { status: "storage-imported", file: args.path };
  } catch (error) {
    await context.close();
    throw error;
  }
}
