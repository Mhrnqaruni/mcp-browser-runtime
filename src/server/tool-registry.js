import * as z from "zod/v4";
import { toolPolicy, confirmAction } from "../security/capabilities.js";
import { assertNavigation } from "../security/navigation.js";
import { configuredFilePolicy } from "../security/paths.js";
import {
  launchManagedSession,
  closeManagedSession,
} from "../browser/managed-session.js";
import { enforcePayloadCeiling } from "../browser/payload-budget.js";
import { executeSessionTool } from "../browser/session-secrets.js";
import { parsePdfBytes } from "../security/pdf.js";

export function installToolRegistry(
  server,
  {
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
  },
) {
  // Wrap every tool with a stable envelope + structured errors without rewriting each handler.
  const rawRegisterTool = server.registerTool.bind(server);
  let toolQueue = Promise.resolve();
  server.registerTool = (name, definition, handler) => {
    if (name === "browser.screenshot")
      definition = {
        description:
          "Capture a bounded viewport JPEG. Optional relative file output requires write capability and confirmation.",
        inputSchema: {
          path: z.string().min(1).optional(),
          quality: z.number().int().min(10).max(80).optional(),
        },
      };
    const safeDescriptions = {
      "files.read_text":
        "Read bounded text using a relative path under the operator read root.",
      "files.read_pdf_text":
        "Extract bounded PDF text in an isolated child process; explicit PDF capability and read root required.",
      "files.write_text":
        "Create a new bounded text file under the operator write root; confirmation required, no overwrite.",
      "browser.get_cookies":
        "List cookie metadata; includeValues requires an explicit request and confirmed session capability.",
      "browser.export_storage_state":
        "Export state to a new JSON file in configured .mcp-data/auth; no inline data or overwrite.",
      "browser.import_storage_state":
        "Import allowed-origin state into a fresh managed context and close the previous context.",
    };
    if (safeDescriptions[name])
      definition = { ...definition, description: safeDescriptions[name] };
    if (name === "browser.get_cookies")
      definition = {
        ...definition,
        inputSchema: {
          ...definition.inputSchema,
          includeValues: z.boolean().optional(),
        },
      };
    const access = toolPolicy(name, policy);
    const outputSchema = z.object({ ok: z.boolean() }).passthrough();
    const descriptor = {
      name,
      description: definition.description,
      enabled: access.enabled,
      confirmation: access.confirmation,
      annotations: access.annotations,
      inputSchema: z.toJSONSchema(z.object(definition.inputSchema)),
      outputSchema: z.toJSONSchema(outputSchema),
    };
    toolDescriptors.push(descriptor);
    if (!access.enabled) return;
    return rawRegisterTool(
      name,
      {
        ...definition,
        outputSchema,
        title: name.replaceAll(".", " / ").replaceAll("_", " "),
        annotations: access.annotations,
      },
      (args, extra) => {
        const operation = toolQueue.then(async () => {
          const requestId = nextRequestId();
          try {
            if (name === "browser.screenshot") {
              if (!state.page) throw new Error("No active page");
              if (args.path) {
                if (!policy.mutations || !policy.writeRoots.length)
                  throw new Error(
                    "Screenshot file output requires write capability",
                  );
                await confirmAction(server, name, args, state.page);
              }
              const bytes = await state.page.screenshot({
                type: "jpeg",
                quality: args.quality ?? 50,
                fullPage: false,
                timeout: 10000,
              });
              const data = bytes.toString("base64");
              const envelope = await buildEnvelope(
                { status: "screenshot", file: args.path ?? null },
                { ok: true, requestId },
              );
              if (
                Buffer.byteLength(JSON.stringify(envelope)) +
                  data.length +
                  512 >
                state.responseBudgetBytes
              )
                throw new Error(
                  "Screenshot exceeds response budget; lower quality",
                );
              if (args.path)
                await (
                  await configuredFilePolicy()
                ).writeBytes(args.path, bytes, 2 * 1024 * 1024);
              return {
                structuredContent: envelope,
                content: [
                  ...respond(envelope).content,
                  { type: "image", data, mimeType: "image/jpeg" },
                ],
              };
            }
            if (access.confirmation)
              await confirmAction(server, name, args, state.page);
            if (name === "browser.goto")
              await assertNavigation(args.url, policy);
            let result;
            if (name === "browser.launch") {
              result = respond(await launchManagedSession(state, policy, args));
              resetRuntimeQueues();
            } else if (name === "browser.close") {
              await closeManagedSession(state);
              resetRuntimeQueues();
              result = respond({ status: "closed" });
            } else if (
              /^browser\.(get_cookies|set_cookies|clear_cookies|export_storage_state|import_storage_state)$/.test(
                name,
              )
            ) {
              result = respond(
                await executeSessionTool(name, args, state, policy),
              );
              if (name === "browser.import_storage_state") resetRuntimeQueues();
            } else if (name === "files.read_text") {
              const text = await (
                await configuredFilePolicy()
              ).readText(args.path);
              const limit = clampNumber(args.maxChars, 1, 20000, 20000);
              result = respond({
                path: args.path,
                text: text.slice(0, limit),
                length: text.length,
                truncated: text.length > limit,
              });
            } else if (name === "files.read_pdf_text") {
              if (!args.path.toLowerCase().endsWith(".pdf"))
                throw new Error("Expected PDF filename");
              const parsed = await parsePdfBytes(
                await (await configuredFilePolicy()).readBytes(args.path),
              );
              const limit = clampNumber(args.maxChars, 1, 20000, 20000);
              result = respond({
                ...parsed,
                path: args.path,
                text: parsed.text.slice(0, limit),
                truncated: parsed.truncated || parsed.text.length > limit,
              });
            } else if (name === "files.write_text") {
              await (
                await configuredFilePolicy()
              ).writeText(args.path, args.text);
              result = respond({
                status: "written",
                path: args.path,
                length: args.text.length,
              });
            } else result = await handler(args, extra);
            const rawPayload = unwrapToolPayload(result);
            const { payload, meta } = extractToolMeta(rawPayload);
            const wrapped = await buildEnvelope(payload, {
              ok: true,
              requestId,
              ...(meta || {}),
            });
            const budgeted = enforcePayloadCeiling(wrapped, {
              maxBytes: state.responseBudgetBytes,
            });
            return {
              ...respond(budgeted.payload),
              structuredContent: budgeted.payload,
            };
          } catch (error) {
            const normalized = normalizeError(error);
            const wrapped = await buildEnvelope(
              { error: normalized },
              { ok: false, requestId, error: normalized },
            );
            const budgeted = enforcePayloadCeiling(wrapped, {
              maxBytes: state.responseBudgetBytes,
            });
            return {
              ...respond(budgeted.payload),
              structuredContent: budgeted.payload,
              isError: true,
            };
          }
        });
        toolQueue = operation.catch(() => {});
        return operation;
      },
    );
  };
}
