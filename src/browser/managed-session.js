import { chromium } from "playwright";
import { installNavigationPolicy } from "../security/navigation.js";
import { createNetworkProxy } from "../security/proxy.js";

export async function closeManagedSession(state) {
  // Only a Browser created by this runtime is stored here; external CDP is disabled.
  try {
    // Revoke network access before waiting for Chromium shutdown. Otherwise a
    // lingering upstream connection can keep both sides waiting on each other.
    await state.networkProxy?.close();
  } finally {
    state.networkProxy = null;
    try {
      if (state.browser) await state.browser.close();
      else if (state.context) await state.context.close();
    } finally {
      state.browser = null;
      state.context = null;
      state.page = null;
      state.pageManager.reset();
      state.persistent = false;
      state.cdpConnected = false;
      state.chromeProcess = null;
    }
  }
}

export async function launchManagedSession(state, policy, args) {
  for (const key of [
    "args",
    "stealth",
    "channel",
    "executablePath",
    "userDataDir",
    "profileDirectory",
    "userAgent",
  ]) {
    if (args[key] !== undefined)
      throw new Error(
        "Custom browser, profile and launch overrides are unavailable",
      );
  }
  if (
    args.slowMoMs !== undefined &&
    (!Number.isFinite(args.slowMoMs) ||
      args.slowMoMs < 0 ||
      args.slowMoMs > 1000)
  )
    throw new Error("Invalid slow motion setting");
  const viewport = args.viewport ?? { width: 1280, height: 720 };
  if (
    ![viewport.width, viewport.height].every(
      (value) => Number.isInteger(value) && value >= 320 && value <= 4096,
    )
  )
    throw new Error("Invalid viewport");
  await closeManagedSession(state);
  try {
    state.networkProxy = await createNetworkProxy(policy);
    state.browser = await chromium.launch({
      headless: args.headless ?? true,
      slowMo: args.slowMoMs ?? 0,
      chromiumSandbox: true,
      proxy: { server: state.networkProxy.url },
      args: [
        "--proxy-bypass-list=<-loopback>",
        "--disable-quic",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      ],
    });
    state.context = await state.browser.newContext({
      viewport,
      serviceWorkers: "block",
      acceptDownloads: false,
    });
    state.context.setDefaultTimeout(10000);
    state.context.setDefaultNavigationTimeout(15000);
    await installNavigationPolicy(state.context, policy);
    await state.pageManager.attachContext(state.context);
    state.page = state.pageManager.getActivePage();
    return {
      status: "launched",
      headless: args.headless ?? true,
      persistent: false,
      browserVersion: state.browser.version(),
      viewport,
    };
  } catch (error) {
    await closeManagedSession(state).catch(() => {});
    throw error;
  }
}
