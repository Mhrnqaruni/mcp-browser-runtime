import { registerCaptureTools } from "../tools/capture.js";
import { registerLifecycleTools } from "../tools/lifecycle.js";
import { registerNavigationTools } from "../tools/navigation.js";
import { registerEventsTools } from "../tools/events.js";
import { registerSessionTools } from "../tools/session.js";
import { registerInteractionTools } from "../tools/interaction.js";
import { registerObservabilityTools } from "../tools/observability.js";
import { registerFormsTools } from "../tools/forms.js";
import { registerFilesTools } from "../tools/files.js";
import { registerJobsTools } from "../tools/jobs.js";
import { registerSearchTools } from "../tools/search.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createPageManager } from "../browser/pages.js";
import { takeA11ySnapshot } from "../browser/snapshot.js";
import {
  ensureDomTracker,
  getDomContext,
  listFrames as listDomFrames,
  getFrameById as getDomFrameById,
} from "../browser/dom-version.js";
import {
  getCaptureDefaults,
  listCaptureProfiles,
  normalizeCaptureProfile,
} from "../browser/capture-profiles.js";
import { enforcePayloadCeiling } from "../browser/payload-budget.js";
import {
  clickByBackendNodeId,
  hoverByBackendNodeId,
  scrollIntoViewIfNeeded,
  setValueByBackendNodeId,
} from "../browser/cdp.js";
import {
  waitForBackendNode,
  waitForSelector,
  waitForText,
} from "../browser/wait.js";
import {
  assertAllowedReadPath,
  assertAllowedWritePath,
  configuredFilePolicy,
} from "../security/paths.js";
import { loadPolicy } from "../security/config.js";
import { toolPolicy, confirmAction } from "../security/capabilities.js";
import { assertNavigation } from "../security/navigation.js";
import {
  launchManagedSession,
  closeManagedSession,
} from "../browser/managed-session.js";
import { installToolRegistry } from "./tool-registry.js";

const policy = loadPolicy();
export const toolDescriptors = [];
import { auditForm, fillForm } from "../browser/forms.js";
import {
  ensureObservability,
  getNetworkRequest,
  listConsoleMessages,
  listNetworkRequests,
} from "../browser/observability.js";
import {
  extractIndeedJobs,
  saveJobsToTxt,
  clickIndeedNextPage,
  detectIndeedAccessIssue,
  extractGoogleResults,
  detectGoogleBlocked,
  saveSearchResultsToTxt,
  tryAcceptGoogleConsent,
} from "../extractors.js";

const state = {
  browser: null,
  context: null,
  page: null, // legacy alias of the active page
  elements: new Map(),
  elementCacheContext: null,
  pageManager: createPageManager(),
  uidMaps: new WeakMap(),
  persistent: false,
  cdpConnected: false,
  cdpManaged: false,
  cdpAutoClose: false,
  chromeProcess: null,
  lastLaunch: null,
  requestSeq: 0,
  contextGeneration: 0,
  pageEventAttached: new WeakSet(),
  dialogs: [],
  dialogById: new Map(),
  dialogSeq: 0,
  downloads: [],
  downloadById: new Map(),
  downloadSeq: 0,
  popups: [],
  popupSeq: 0,
  captureProfile: "light",
  responseBudgetBytes: 280000,
};

const DEFAULT_VIEWPORT = { width: 1280, height: 720 };
const TOOL_META_KEY = "__meta";
const INTERACTIVE_AX_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "searchbox",
  "combobox",
  "listbox",
  "option",
  "checkbox",
  "radio",
  "tab",
  "menuitem",
  "switch",
  "spinbutton",
  "slider",
]);

function respond(data) {
  return {
    content: [
      {
        type: "text",
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

function withToolMeta(payload, meta = {}) {
  if (!meta || typeof meta !== "object" || Object.keys(meta).length === 0)
    return payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return { ...payload, [TOOL_META_KEY]: meta };
  }
  return { data: payload, [TOOL_META_KEY]: meta };
}

function extractToolMeta(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { payload, meta: {} };
  }
  if (!Object.prototype.hasOwnProperty.call(payload, TOOL_META_KEY)) {
    return { payload, meta: {} };
  }
  const metaRaw = payload[TOOL_META_KEY];
  const meta =
    metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw)
      ? metaRaw
      : {};
  const cleaned = { ...payload };
  delete cleaned[TOOL_META_KEY];
  return { payload: cleaned, meta };
}

function nextRequestId() {
  state.requestSeq += 1;
  return `req-${Date.now()}-${state.requestSeq}`;
}

function unwrapToolPayload(result) {
  if (result === undefined) return {};
  if (result && typeof result === "object" && Array.isArray(result.content)) {
    const text = result.content?.[0]?.text;
    if (typeof text !== "string") return {};
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return result;
}

function classifyErrorCode(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  if (!msg) return "INTERNAL";
  if (msg.includes("timeout")) return "TIMEOUT";
  if (
    msg.includes("not allowed") ||
    msg.includes("permission") ||
    msg.includes("forbidden")
  )
    return "PERMISSION";
  if (
    msg.includes("stale") ||
    msg.includes("no uid map") ||
    msg.includes("unknown uid") ||
    msg.includes("run browser.list again") ||
    msg.includes("run browser.take_snapshot again")
  ) {
    return "STALE_REF";
  }
  if (
    msg.includes("execution context was destroyed") ||
    msg.includes("target closed") ||
    msg.includes("navigation") ||
    msg.includes("net::")
  ) {
    return "NAVIGATION";
  }
  if (
    msg.includes("not found") ||
    msg.includes("no open page") ||
    msg.includes("no element found") ||
    msg.includes("unknown requestid") ||
    msg.includes("unknown frameid")
  ) {
    return "NOT_FOUND";
  }
  return "INTERNAL";
}

function normalizeError(error) {
  const code = classifyErrorCode(error);
  return {
    code,
    message:
      "Tool failed or was denied. Check configuration, client confirmation and requested input.",
  };
}

async function getEnvelopeContext(meta = {}) {
  const page =
    meta.page || state.pageManager?.getActivePage?.() || state.page || null;
  if (!page) {
    return {
      page: null,
      pageId: null,
      url: null,
      title: null,
      domVersion: null,
      activeFrameId: null,
    };
  }

  let frame = null;
  if (meta.frameId) {
    try {
      frame = getDomFrameById(page, meta.frameId);
    } catch {
      frame = null;
    }
  }
  if (!frame) frame = page.mainFrame();

  let pageId = null;
  try {
    pageId = state.pageManager?.getPageId?.(page) ?? null;
  } catch {
    pageId = null;
  }

  let url = null;
  let title = null;
  let domVersion = null;
  let activeFrameId = null;
  try {
    url = page.url();
  } catch {
    url = null;
  }
  try {
    if (!page.isClosed?.()) {
      title = await page.title();
    }
  } catch {
    title = null;
  }
  try {
    const ctx = getDomContext(page, frame);
    domVersion = ctx?.domVersion || null;
    activeFrameId = ctx?.frameId || null;
  } catch {
    domVersion = null;
    activeFrameId = null;
  }

  return { page, pageId, url, title, domVersion, activeFrameId };
}

async function buildEnvelope(payload, meta = {}) {
  const ctx = await getEnvelopeContext(meta);
  const base = {
    ok: Boolean(meta.ok),
    requestId: meta.requestId || nextRequestId(),
    timestamp: new Date().toISOString(),
    pageId: ctx.pageId,
    url: ctx.url,
    title: ctx.title,
    domVersion: ctx.domVersion,
    activeFrameId: ctx.activeFrameId,
  };

  if (!base.ok && meta.error) {
    base.error = meta.error;
  }

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const merged = { ...base };
    const reserveCollisionKey = (key) => {
      const raw = String(key || "value");
      const normalized = raw.replace(/[^a-zA-Z0-9_]/g, "_");
      const candidate = `payload${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
      if (!Object.prototype.hasOwnProperty.call(merged, candidate))
        return candidate;
      let i = 2;
      while (Object.prototype.hasOwnProperty.call(merged, `${candidate}_${i}`))
        i += 1;
      return `${candidate}_${i}`;
    };

    for (const [key, value] of Object.entries(payload)) {
      if (Object.prototype.hasOwnProperty.call(base, key)) {
        const collisionKey = reserveCollisionKey(key);
        merged[collisionKey] = value;
      } else {
        merged[key] = value;
      }
    }

    // Keep backwards compatibility for non-boolean payload "ok" values.
    if (
      Object.prototype.hasOwnProperty.call(payload, "ok") &&
      typeof payload.ok !== "boolean"
    ) {
      merged.payloadOk = payload.ok;
    }
    return merged;
  }

  if (payload === undefined || payload === null) return base;
  return { ...base, data: payload };
}

function truncateText(text, maxChars) {
  if (!text) return "";
  const limit = typeof maxChars === "number" ? maxChars : 0;
  if (limit <= 0 || text.length <= limit) return text;
  if (limit <= 3) return text.slice(0, limit);
  return text.slice(0, limit - 3) + "...";
}

function clampNumber(value, min, max, fallback) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function normalizeKey(key) {
  const raw = String(key ?? "");
  if (raw === " ") return "Space";
  const trimmed = raw.trim();
  if (!trimmed && raw.includes(" ")) return "Space";
  if (/^space(bar)?$/i.test(trimmed)) return "Space";
  if (/^esc$/i.test(trimmed)) return "Escape";
  // Playwright supports "Control+A" style combos; removing spaces makes those robust.
  return trimmed.replace(/\s*\+\s*/g, "+") || raw;
}

function normalizeCaptureDetail(detail) {
  return String(detail || "low").toLowerCase() === "high" ? "high" : "low";
}

function getActiveCaptureProfile() {
  return normalizeCaptureProfile(
    state.captureProfile || ENV_DEFAULTS.captureProfile || "light",
  );
}

function resetCaptureProfileToDefault() {
  state.captureProfile = normalizeCaptureProfile(
    ENV_DEFAULTS.captureProfile || "light",
  );
  return state.captureProfile;
}

function resolveCaptureDefaults(toolName, detail = "low") {
  const profile = getActiveCaptureProfile();
  const normalizedDetail = normalizeCaptureDetail(detail);
  return getCaptureDefaults(profile, toolName, normalizedDetail);
}

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensurePage() {
  const page = state.pageManager?.getActivePage?.() || state.page;
  if (!page) {
    throw new Error(
      "Browser is not launched. Run browser.launch or browser.connect_cdp first.",
    );
  }
  ensureDomTracker(page);
  void ensurePageEventListeners(page);
  state.page = page;
  return page;
}

function getFrameScope(page, frame = null) {
  const target = frame || page.mainFrame();
  return target === page.mainFrame() ? page : target;
}

async function resolveFrame(page, opts = {}) {
  ensureDomTracker(page);
  const { frameId, frameSelector, timeoutMs } = opts || {};
  if (frameId) {
    const frame = getDomFrameById(page, frameId);
    if (!frame) {
      throw new Error(
        `Unknown frameId "${frameId}". Run browser.list_frames first.`,
      );
    }
    return frame;
  }

  if (frameSelector) {
    const timeout = clampNumber(timeoutMs, 500, 120000, 15000);
    const locator = page.locator(frameSelector).first();
    await locator.waitFor({ state: "attached", timeout });
    const handle = await locator.elementHandle();
    if (!handle) {
      throw new Error(
        `No frame element found for selector "${frameSelector}".`,
      );
    }
    const frame = await handle.contentFrame();
    await handle.dispose();
    if (!frame) {
      throw new Error(
        `Selector "${frameSelector}" did not resolve to an iframe/frame element.`,
      );
    }
    return frame;
  }

  return page.mainFrame();
}

function clearElementCache() {
  state.elements.clear();
  state.elementCacheContext = null;
}

function getElementCacheContextKey(page, frame = null) {
  const pageId = state.pageManager?.getPageId?.(page) ?? 0;
  const dom = getDomContext(page, frame);
  return `${pageId}:${dom.frameId}:${dom.frameDomVersion}`;
}

function setElementCacheContext(page, frame = null) {
  const key = getElementCacheContextKey(page, frame);
  state.elementCacheContext = key;
  return key;
}

function assertElementCacheFresh(page, frame = null) {
  const expected = getElementCacheContextKey(page, frame);
  if (!state.elementCacheContext || state.elementCacheContext !== expected) {
    throw new Error(
      "Stale element cache detected after DOM/frame change. Run browser.list again.",
    );
  }
  return expected;
}

function getCachedElement(page, frame, elementId) {
  const expected = assertElementCacheFresh(page, frame);
  const cached = state.elements.get(elementId);
  if (!cached)
    throw new Error(
      `No cached element for id ${elementId}. Run browser.list again.`,
    );
  if (cached.contextKey !== expected) {
    throw new Error(
      `Cached element ${elementId} belongs to a stale page/frame snapshot. Run browser.list again.`,
    );
  }
  return cached;
}

function resolveRootScopeSelector(page, frame, opts = {}) {
  const rawSelector =
    typeof opts.rootSelector === "string" ? opts.rootSelector.trim() : "";
  const rootElementId =
    typeof opts.rootElementId === "number" ? opts.rootElementId : null;

  if (rootElementId !== null) {
    const cached = getCachedElement(page, frame, rootElementId);
    if (!cached.selector) {
      throw new Error(
        `Cached root element ${rootElementId} has no selector. Re-run browser.list with includeSelectors=true.`,
      );
    }
    return cached.selector;
  }

  return rawSelector || null;
}

function getOrCreateUidStore(page) {
  let store = state.uidMaps.get(page);
  if (!store) {
    store = { frames: new Map() };
    state.uidMaps.set(page, store);
  }
  return store;
}

function setUidMapForFrame(page, frame, uidToBackend) {
  const ctx = getDomContext(page, frame);
  const store = getOrCreateUidStore(page);
  store.frames.set(ctx.frameId, {
    createdAt: Date.now(),
    url: page.url(),
    domVersion: ctx.domVersion,
    uidToBackend,
  });
  return ctx;
}

function getBackendNodeIdForUid(page, uid, frame = null) {
  const store = state.uidMaps.get(page);
  const frames = store?.frames;
  const requestedCtx = getDomContext(page, frame);
  const mainCtx = getDomContext(page, page.mainFrame());

  if (!frames) {
    throw new Error(
      "No uid map available for this page. Run browser.take_snapshot first.",
    );
  }

  const resolveEntry = (ctx) => {
    const entry = frames.get(ctx.frameId);
    if (!entry) return null;
    if (entry.domVersion && entry.domVersion !== ctx.domVersion) {
      throw new Error(
        "Stale uid map detected after DOM change. Run browser.take_snapshot again.",
      );
    }
    return entry;
  };

  let entry = resolveEntry(requestedCtx);
  if (!entry && requestedCtx.frameId !== mainCtx.frameId) {
    entry = resolveEntry(mainCtx);
  }
  if (!entry) {
    throw new Error(
      `No uid map available for frame "${requestedCtx.frameId}". Run browser.take_snapshot first.`,
    );
  }

  let mapped = entry.uidToBackend?.get(uid);
  if (!mapped && requestedCtx.frameId !== mainCtx.frameId) {
    const mainEntry = resolveEntry(mainCtx);
    mapped = mainEntry?.uidToBackend?.get(uid);
  }

  const backendNodeId =
    mapped && typeof mapped === "object" ? mapped.backendNodeId : mapped;

  if (!backendNodeId) {
    throw new Error(
      `Unknown uid "${uid}". Run browser.take_snapshot again and use a current uid.`,
    );
  }
  return backendNodeId;
}

function withFrameMeta(page, frame, payload) {
  const ctx = getDomContext(page, frame);
  return withToolMeta(payload, { frameId: ctx.frameId });
}

const EXPECT_EVENT_ACTION_ALLOWLIST = new Set([
  "browser.click",
  "browser.press",
  "browser.goto",
  "browser.reload",
  "browser.back",
  "browser.forward",
  "browser.hover",
]);

function resetRuntimeQueues() {
  clearElementCache();
  state.contextGeneration += 1;
  state.uidMaps = new WeakMap();
  state.pageEventAttached = new WeakSet();
  state.dialogs = [];
  state.dialogById = new Map();
  state.dialogSeq = 0;
  state.downloads = [];
  state.downloadById = new Map();
  state.downloadSeq = 0;
  state.popups = [];
  state.popupSeq = 0;
}

function getPageIdSafe(page) {
  if (!page) return null;
  try {
    return state.pageManager?.getPageId?.(page) ?? null;
  } catch {
    return null;
  }
}

function pushBounded(queue, item, maxItems = 400) {
  queue.push(item);
  let dropped = [];
  if (queue.length > maxItems) {
    dropped = queue.splice(0, queue.length - maxItems);
  }
  return dropped;
}

async function ensurePageEventListeners(page) {
  if (!page || state.pageEventAttached.has(page)) return;
  state.pageEventAttached.add(page);
  const listenerGeneration = state.contextGeneration;

  page.on("dialog", async (dialog) => {
    if (listenerGeneration !== state.contextGeneration) return;
    state.dialogSeq += 1;
    const dialogId = `dlg-${state.dialogSeq}`;
    const entry = {
      dialogId,
      pageId: getPageIdSafe(page),
      type: String(dialog.type?.() || ""),
      message: String(dialog.message?.() || ""),
      defaultValue: String(dialog.defaultValue?.() || ""),
      createdAt: new Date().toISOString(),
      status: "pending",
      resolution: null,
      handledAt: null,
      _dialog: dialog,
      _timer: null,
    };
    state.dialogById.set(dialogId, entry);
    const dropped = pushBounded(state.dialogs, entry, 400);
    for (const stale of dropped) {
      if (stale?._timer) clearTimeout(stale._timer);
      if (stale?.dialogId) state.dialogById.delete(stale.dialogId);
    }

    const timeoutMs = 15000;
    entry._timer = setTimeout(async () => {
      if (listenerGeneration !== state.contextGeneration) return;
      if (entry.status !== "pending") return;
      try {
        await dialog.dismiss();
        entry.status = "auto-dismissed";
        entry.resolution = { action: "dismiss", reason: "timeout" };
        entry.handledAt = new Date().toISOString();
      } catch (error) {
        entry.status = "error";
        entry.resolution = {
          action: "dismiss",
          reason: "timeout",
          error: String(
            error?.message || error || "Failed to auto-dismiss dialog",
          ),
        };
        entry.handledAt = new Date().toISOString();
      }
    }, timeoutMs);
  });

  page.on("download", async (download) => {
    if (listenerGeneration !== state.contextGeneration) return;
    state.downloadSeq += 1;
    const downloadId = `dl-${state.downloadSeq}`;
    const item = {
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
    state.downloadById.set(downloadId, item);
    const dropped = pushBounded(state.downloads, item, 400);
    for (const stale of dropped) {
      if (stale?.downloadId) state.downloadById.delete(stale.downloadId);
    }
  });

  page.on("popup", async (popupPage) => {
    if (listenerGeneration !== state.contextGeneration) return;
    try {
      state.pageManager.attachPage(popupPage);
      await ensurePageEventListeners(popupPage);
      await ensureObservability(popupPage);
    } catch {
      // best effort
    }
    state.popupSeq += 1;
    pushBounded(
      state.popups,
      {
        popupId: `pop-${state.popupSeq}`,
        openerPageId: getPageIdSafe(page),
        pageId: getPageIdSafe(popupPage),
        createdAt: new Date().toISOString(),
        consumed: false,
        url: (() => {
          try {
            return popupPage.url();
          } catch {
            return "";
          }
        })(),
      },
      200,
    );
  });

  page.once("close", () => {
    state.pageEventAttached.delete(page);
  });
}

function buildUrlMatcher(pattern, regex) {
  if (!pattern) return () => true;
  if (regex) {
    let compiled;
    try {
      compiled = new RegExp(pattern);
    } catch {
      throw new Error(`Invalid regex pattern "${pattern}".`);
    }
    return (url) => compiled.test(String(url || ""));
  }
  const needle = String(pattern || "").toLowerCase();
  return (url) =>
    String(url || "")
      .toLowerCase()
      .includes(needle);
}

async function runExpectAfterAction(page, afterAction) {
  if (!afterAction) return { executed: false };
  const toolName = String(afterAction.toolName || "").trim();
  if (!toolName)
    throw new Error(
      "afterAction.toolName is required when afterAction is provided.",
    );
  if (!EXPECT_EVENT_ACTION_ALLOWLIST.has(toolName)) {
    throw new Error(`afterAction.toolName "${toolName}" is not allowed.`);
  }
  const args =
    afterAction.args && typeof afterAction.args === "object"
      ? afterAction.args
      : {};
  const timeout = clampNumber(args.timeoutMs, 1000, 120000, 30000);

  if (toolName === "browser.goto") {
    if (!args.url)
      throw new Error("afterAction browser.goto requires args.url.");
    await page.goto(String(args.url), {
      waitUntil: args.waitUntil || "domcontentloaded",
      timeout,
    });
    clearElementCache();
    state.uidMaps.delete(page);
    return { executed: true, toolName };
  }

  if (toolName === "browser.reload") {
    await page.reload({
      waitUntil: args.waitUntil || "domcontentloaded",
      timeout,
    });
    clearElementCache();
    state.uidMaps.delete(page);
    return { executed: true, toolName };
  }

  if (toolName === "browser.back") {
    await page.goBack({
      waitUntil: args.waitUntil || "domcontentloaded",
      timeout,
    });
    clearElementCache();
    state.uidMaps.delete(page);
    return { executed: true, toolName };
  }

  if (toolName === "browser.forward") {
    await page.goForward({
      waitUntil: args.waitUntil || "domcontentloaded",
      timeout,
    });
    clearElementCache();
    state.uidMaps.delete(page);
    return { executed: true, toolName };
  }

  const frame = await resolveFrame(page, {
    frameId: typeof args.frameId === "string" ? args.frameId : undefined,
    frameSelector:
      typeof args.frameSelector === "string" ? args.frameSelector : undefined,
    timeoutMs: timeout,
  });
  const scope = getFrameScope(page, frame);

  if (toolName === "browser.click") {
    if (typeof args.selector === "string" && args.selector.trim()) {
      await scope.click(args.selector, { timeout, force: Boolean(args.force) });
      clearElementCache();
      return {
        executed: true,
        toolName,
        frameId: getDomContext(page, frame).frameId,
      };
    }
    if (typeof args.text === "string" && args.text.trim()) {
      await scope
        .getByText(args.text, { exact: false })
        .first()
        .click({ timeout, force: Boolean(args.force) });
      clearElementCache();
      return {
        executed: true,
        toolName,
        frameId: getDomContext(page, frame).frameId,
      };
    }
    throw new Error(
      "afterAction browser.click requires args.selector or args.text.",
    );
  }

  if (toolName === "browser.hover") {
    if (typeof args.selector === "string" && args.selector.trim()) {
      await scope.hover(args.selector, { timeout, force: Boolean(args.force) });
      clearElementCache();
      return {
        executed: true,
        toolName,
        frameId: getDomContext(page, frame).frameId,
      };
    }
    if (typeof args.text === "string" && args.text.trim()) {
      await scope
        .getByText(args.text, { exact: false })
        .first()
        .hover({ timeout, force: Boolean(args.force) });
      clearElementCache();
      return {
        executed: true,
        toolName,
        frameId: getDomContext(page, frame).frameId,
      };
    }
    throw new Error(
      "afterAction browser.hover requires args.selector or args.text.",
    );
  }

  if (toolName === "browser.press") {
    if (typeof args.selector === "string" && args.selector.trim()) {
      await scope.focus(args.selector);
    }
    await page.keyboard.press(normalizeKey(args.key || "Enter"));
    return {
      executed: true,
      toolName,
      frameId: getDomContext(page, frame).frameId,
    };
  }

  throw new Error(`afterAction "${toolName}" is not implemented.`);
}

function getOriginOrNull(urlValue) {
  try {
    return new URL(String(urlValue || "")).origin;
  } catch {
    return null;
  }
}

function isOriginAllowed(origin, allowlist) {
  if (!origin) return false;
  const list = Array.isArray(allowlist) ? allowlist : [];
  if (!list.length) return false;

  const normalizedOrigin = origin.toLowerCase();
  for (const rawEntry of list) {
    const entry = String(rawEntry || "").trim();
    if (!entry) continue;
    if (entry === "*") return false;

    let normalizedEntry = entry.toLowerCase();
    try {
      normalizedEntry = new URL(entry).origin.toLowerCase();
    } catch {
      // Keep raw entry for exact string matching when it is not a full URL.
    }

    if (normalizedOrigin === normalizedEntry) return true;
  }
  return false;
}

function estimatePayloadBytes(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return Buffer.byteLength(String(value ?? ""), "utf8");
  }
}

function assertPayloadWithinLimit(value, maxBytes) {
  const bytes = estimatePayloadBytes(value);
  if (bytes > maxBytes) {
    throw new Error(
      `Payload too large: ${bytes} bytes exceeds limit ${maxBytes}.`,
    );
  }
  return bytes;
}

async function ensureDir(filePath) {
  const dir = path.dirname(path.resolve(filePath));
  await fs.mkdir(dir, { recursive: true });
}

function readEnvValue(names) {
  for (const name of names) {
    if (!name) continue;
    const raw = process.env[name];
    if (raw !== undefined) return raw;
  }
  return undefined;
}

function parseEnvBool(name, altName) {
  const raw = readEnvValue([name, altName]);
  if (raw === undefined) return undefined;
  const value = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(value)) return true;
  if (["0", "false", "no", "n", "off"].includes(value)) return false;
  return undefined;
}

function parseEnvNumber(name, altName) {
  const raw = readEnvValue([name, altName]);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isNaN(value) ? undefined : value;
}

function parseEnvString(name, altName) {
  const raw = readEnvValue([name, altName]);
  if (raw === undefined) return undefined;
  const value = String(raw).trim();
  return value ? value : undefined;
}

function parseEnvArgs(name, altName) {
  const raw = readEnvValue([name, altName]);
  if (!raw) return undefined;
  const trimmed = String(raw).trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      // fall back to split parsing
    }
  }
  return trimmed
    .split(/[;,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const ENV_DEFAULTS = {
  headless: parseEnvBool("MCP_HEADLESS", "GEMINI_CLI_MCP_HEADLESS"),
  slowMoMs: parseEnvNumber("MCP_SLOWMO_MS", "GEMINI_CLI_MCP_SLOWMO_MS"),
  args: parseEnvArgs("MCP_ARGS", "GEMINI_CLI_MCP_ARGS"),
  stealth: parseEnvBool("MCP_STEALTH", "GEMINI_CLI_MCP_STEALTH"),
  channel: parseEnvString("MCP_CHANNEL", "GEMINI_CLI_MCP_CHANNEL"),
  executablePath: parseEnvString(
    "MCP_EXECUTABLE_PATH",
    "GEMINI_CLI_MCP_EXECUTABLE_PATH",
  ),
  userDataDir: parseEnvString(
    "MCP_USER_DATA_DIR",
    "GEMINI_CLI_MCP_USER_DATA_DIR",
  ),
  profileDirectory: parseEnvString("MCP_PROFILE", "GEMINI_CLI_MCP_PROFILE"),
  cdpEndpoint: parseEnvString(
    "MCP_CDP_ENDPOINT",
    "GEMINI_CLI_MCP_CDP_ENDPOINT",
  ),
  cdpPort: parseEnvNumber("MCP_CDP_PORT", "GEMINI_CLI_MCP_CDP_PORT"),
  cdpWaitMs: parseEnvNumber("MCP_CDP_WAIT_MS", "GEMINI_CLI_MCP_CDP_WAIT_MS"),
  cdpAutoClose: parseEnvBool(
    "MCP_CDP_AUTO_CLOSE",
    "GEMINI_CLI_MCP_CDP_AUTO_CLOSE",
  ),
  chromePath: parseEnvString("MCP_CHROME_PATH", "GEMINI_CLI_MCP_CHROME_PATH"),
  forceCdp: parseEnvBool("MCP_FORCE_CDP", "GEMINI_CLI_MCP_FORCE_CDP"),
  requireProfile: parseEnvBool(
    "MCP_REQUIRE_PROFILE",
    "GEMINI_CLI_MCP_REQUIRE_PROFILE",
  ),
  allowEvaluate: parseEnvBool(
    "MCP_ALLOW_EVALUATE",
    "GEMINI_CLI_MCP_ALLOW_EVALUATE",
  ),
  evaluateAllowOrigins: parseEnvArgs(
    "MCP_EVALUATE_ALLOW_ORIGINS",
    "GEMINI_CLI_MCP_EVALUATE_ALLOW_ORIGINS",
  ),
  evaluateTimeoutMs: parseEnvNumber(
    "MCP_EVALUATE_TIMEOUT_MS",
    "GEMINI_CLI_MCP_EVALUATE_TIMEOUT_MS",
  ),
  evaluateMaxBytes: parseEnvNumber(
    "MCP_EVALUATE_MAX_BYTES",
    "GEMINI_CLI_MCP_EVALUATE_MAX_BYTES",
  ),
  captureProfile: parseEnvString(
    "MCP_CAPTURE_PROFILE",
    "GEMINI_CLI_MCP_CAPTURE_PROFILE",
  ),
  maxResponseBytes: parseEnvNumber(
    "MCP_MAX_RESPONSE_BYTES",
    "GEMINI_CLI_MCP_MAX_RESPONSE_BYTES",
  ),
};

state.captureProfile = normalizeCaptureProfile(
  ENV_DEFAULTS.captureProfile || state.captureProfile || "light",
);
state.responseBudgetBytes = clampNumber(
  ENV_DEFAULTS.maxResponseBytes,
  32768,
  2_000_000,
  state.responseBudgetBytes,
);

function hasDefaultChromeUserDataDir(userDataDir) {
  if (!userDataDir) return false;
  return /(^|\\)Google\\Chrome\\User Data(\\|$)/i.test(userDataDir);
}

function normalizeProfilePath(userDataDir, profileDirectory) {
  if (!userDataDir) {
    return { userDataDir, profileDirectory, warnings: [] };
  }
  const normalized = path.normalize(userDataDir);
  const base = path.basename(normalized);
  const warnings = [];
  const profileMatch = /^(Profile \d+|Default)$/i;
  if (profileMatch.test(base)) {
    const parent = path.dirname(normalized);
    if (profileDirectory && profileDirectory !== base) {
      warnings.push(
        `userDataDir pointed to "${base}" but profileDirectory was "${profileDirectory}". Using parent userDataDir with provided profileDirectory.`,
      );
      return { userDataDir: parent, profileDirectory, warnings };
    }
    warnings.push(
      `userDataDir pointed to profile folder "${base}". Normalized to parent and set profileDirectory.`,
    );
    return { userDataDir: parent, profileDirectory: base, warnings };
  }
  return { userDataDir, profileDirectory, warnings };
}

async function resolveChromePath(explicitPath) {
  if (explicitPath) return explicitPath;
  const programFiles = process.env["PROGRAMFILES"] || "C:\\Program Files";
  const programFilesX86 =
    process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
  const localAppData =
    process.env["LOCALAPPDATA"] ||
    path.join(
      process.env["USERPROFILE"] || "C:\\Users\\User",
      "AppData\\Local",
    );
  const candidates = [
    path.join(programFiles, "Google\\Chrome\\Application\\chrome.exe"),
    path.join(programFilesX86, "Google\\Chrome\\Application\\chrome.exe"),
    path.join(localAppData, "Google\\Chrome\\Application\\chrome.exe"),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // keep searching
    }
  }
  return null;
}

function buildArgs(baseArgs, profileDirectory) {
  const args = Array.isArray(baseArgs) ? [...baseArgs] : [];
  if (profileDirectory) {
    const hasProfileArg = args.some((arg) =>
      arg.startsWith("--profile-directory="),
    );
    if (!hasProfileArg) {
      args.push(`--profile-directory=${profileDirectory}`);
    }
  }
  return args;
}

const server = new McpServer({
  name: "playwright-browser",
  version: "2.0.0",
});

installToolRegistry(server, {
  policy,
  state,
  toolDescriptors,
  nextRequestId,
  respond,
  resetRuntimeQueues,
  clampNumber,
  unwrapToolPayload,
  extractToolMeta,
  buildEnvelope,
  normalizeError,
});

export async function main() {
  await configuredFilePolicy();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Playwright browser server ready (experimental).");
  const stop = async () => {
    const timer = setTimeout(() => process.exit(1), 5000);
    timer.unref();
    await closeManagedSession(state).catch(() => {});
    await server.close().catch(() => {});
    clearTimeout(timer);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  process.stdin.once("end", stop);
}

registerCaptureTools(server, {
  INTERACTIVE_AX_ROLES,
  assertAllowedReadPath,
  assertAllowedWritePath,
  assertPayloadWithinLimit,
  clampNumber,
  clearElementCache,
  ensureDir,
  ensurePage,
  fs,
  getActiveCaptureProfile,
  getCachedElement,
  getDomContext,
  getFrameScope,
  listCaptureProfiles,
  normalizeCaptureDetail,
  normalizeCaptureProfile,
  resolveCaptureDefaults,
  resolveFrame,
  resolveRootScopeSelector,
  respond,
  setElementCacheContext,
  setUidMapForFrame,
  state,
  takeA11ySnapshot,
  withFrameMeta,
  z,
});
registerLifecycleTools(server, {
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
});
registerNavigationTools(server, {
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
});
registerEventsTools(server, {
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
});
registerSessionTools(server, {
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
});
registerInteractionTools(server, {
  ENV_DEFAULTS,
  assertPayloadWithinLimit,
  auditForm,
  clampNumber,
  clearElementCache,
  clickByBackendNodeId,
  ensurePage,
  fillForm,
  getBackendNodeIdForUid,
  getCachedElement,
  getFrameScope,
  getOriginOrNull,
  hoverByBackendNodeId,
  isOriginAllowed,
  normalizeKey,
  resolveFrame,
  respond,
  scrollIntoViewIfNeeded,
  setValueByBackendNodeId,
  withFrameMeta,
  z,
});
registerObservabilityTools(server, {
  assertAllowedWritePath,
  ensureDir,
  ensurePage,
  fs,
  getNetworkRequest,
  listConsoleMessages,
  listNetworkRequests,
  respond,
  z,
});
registerFormsTools(server, {
  clampNumber,
  ensurePage,
  escapeRegex,
  respond,
  z,
});
registerFilesTools(server, {
  assertAllowedReadPath,
  assertAllowedWritePath,
  clampNumber,
  ensureDir,
  escapeRegex,
  fs,
  path,
  respond,
  z,
});
registerJobsTools(server, {
  assertAllowedWritePath,
  clearElementCache,
  clickIndeedNextPage,
  detectIndeedAccessIssue,
  ensurePage,
  extractIndeedJobs,
  respond,
  saveJobsToTxt,
  z,
});
registerSearchTools(server, {
  assertAllowedWritePath,
  detectGoogleBlocked,
  ensurePage,
  extractGoogleResults,
  respond,
  saveSearchResultsToTxt,
  tryAcceptGoogleConsent,
  z,
});
