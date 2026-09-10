import { createHash } from "node:crypto";

// Deliberately unavailable pending their dedicated safety implementations.
const unavailable = new Set([
  "browser.connect_cdp",
  "browser.launch_chrome_cdp",
  "browser.get_cookies",
  "browser.set_cookies",
  "browser.clear_cookies",
  "browser.export_storage_state",
  "browser.import_storage_state",
  "browser.set_input_files",
  "browser.save_download",
  "browser.screenshot",
  "browser.visual_snapshot",
  "browser.get_network_request",
  "files.read_pdf_text",
  "files.list_dir",
  "browser.expect_event",
]);
const mutations = new Set([
  "browser.get_cookies",
  "browser.set_cookies",
  "browser.clear_cookies",
  "browser.export_storage_state",
  "browser.import_storage_state",
  "browser.click",
  "browser.click_at",
  "browser.click_at_page",
  "browser.type",
  "browser.fill",
  "browser.fill_form",
  "browser.press",
  "browser.handle_dialog",
  "browser.hover",
  "browser.evaluate",
  "files.write_text",
]);
const stateChanges = new Set([
  "browser.launch",
  "browser.close",
  "browser.close_page",
  "browser.new_page",
  "browser.select_page",
  "browser.goto",
  "browser.back",
  "browser.forward",
  "browser.reload",
  "browser.scroll_by",
  "browser.scroll_to",
  "browser.scroll_container",
  "browser.scroll_to_uid",
  "browser.set_capture_profile",
]);
const inspections = new Set([
  "browser.get_capture_profile",
  "browser.list_pages",
  "browser.list_frames",
  "browser.wait",
  "browser.wait_for",
  "browser.list_dialogs",
  "browser.wait_for_download",
  "browser.wait_for_popup",
  "browser.query_dom",
  "browser.get_scroll_state",
  "browser.get_scrollables",
  "browser.get_container_scroll_state",
  "browser.take_snapshot",
  "browser.snapshot",
  "browser.list",
  "browser.extract_text",
  "browser.extract_html",
  "browser.form_audit",
  "browser.list_console_messages",
  "browser.list_network_requests",
]);

export function toolPolicy(name, config) {
  let enabled =
    (inspections.has(name) || mutations.has(name) || stateChanges.has(name)) &&
    !unavailable.has(name);
  if (name === "files.read_text") enabled = config.readRoots.length > 0;
  if (name === "files.read_pdf_text")
    enabled = config.pdf && config.readRoots.length > 0;
  if (name === "files.write_text") enabled = config.writeRoots.length > 0;
  if (name === "browser.evaluate") enabled = config.evaluate;
  if (name === "browser.screenshot") enabled = true;
  if (
    /^browser\.(get_cookies|set_cookies|clear_cookies|export_storage_state|import_storage_state)$/.test(
      name,
    )
  )
    enabled = config.sessionSecrets;
  const confirmation = mutations.has(name);
  if (confirmation && !config.mutations) enabled = false;
  return {
    enabled,
    confirmation,
    annotations: {
      readOnlyHint:
        !confirmation &&
        !stateChanges.has(name) &&
        name !== "browser.screenshot",
      destructiveHint: confirmation || name.startsWith("browser.close"),
      idempotentHint:
        !confirmation &&
        !stateChanges.has(name) &&
        name !== "browser.screenshot",
      openWorldHint: !name.startsWith("files."),
    },
  };
}

export async function confirmAction(server, name, args, page) {
  if (!server.server.getClientCapabilities()?.elicitation?.form)
    throw new Error("Client confirmation support is required");
  const description = JSON.stringify(args);
  if (description.length > 16000)
    throw new Error("Action too large for a complete confirmation");
  const fingerprint = async () => {
    if (!page) return null;
    if (page.isClosed()) throw new Error("Page closed");
    const frames = page.frames();
    if (frames.length > 32) throw new Error("Too many frames for confirmation");
    const hash = createHash("sha256");
    let bytes = 0;
    hash.update(page.url());
    for (const frame of frames) {
      const content = await frame.content();
      bytes += Buffer.byteLength(content);
      if (bytes > 2 * 1024 * 1024)
        throw new Error("Page too large for confirmation");
      hash.update(frame.url());
      hash.update(content);
    }
    return hash.digest("hex");
  };
  const before = await fingerprint();
  const result = await server.server.elicitInput(
    {
      mode: "form",
      message: `Confirm one ${name} action. Arguments: ${description}`,
      requestedSchema: {
        type: "object",
        properties: {
          approve: {
            type: "boolean",
            title: "Approve this single action",
            default: false,
          },
        },
        required: ["approve"],
      },
    },
    { timeout: 60000 },
  );
  if (result.action !== "accept" || result.content?.approve !== true)
    throw new Error("Action not approved");
  if (before !== (await fingerprint()))
    throw new Error("Page changed during confirmation");
}
