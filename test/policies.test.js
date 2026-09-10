import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadPolicy } from "../src/security/config.js";
import {
  assertNavigation,
  isPublicAddress,
} from "../src/security/navigation.js";
import { toolPolicy, confirmAction } from "../src/security/capabilities.js";
import { createFilePolicy } from "../src/security/paths.js";
import { redact, redactUrl } from "../src/security/redaction.js";

test("default policy excludes privileged tools and every mutation", () => {
  const policy = loadPolicy({});
  for (const name of [
    "browser.evaluate",
    "browser.connect_cdp",
    "browser.get_cookies",
    "browser.export_storage_state",
    "files.read_text",
    "browser.click",
    "jobs.extract_indeed",
  ]) {
    assert.equal(toolPolicy(name, policy).enabled, false, name);
  }
  assert.equal(toolPolicy("browser.snapshot", policy).enabled, true);
  assert.equal(
    toolPolicy("browser.unknown_privileged_tool", policy).enabled,
    false,
  );
});

test("invalid and legacy configuration fails closed", () => {
  for (const env of [
    { MCP_ALLOWED_ORIGINS: "*" },
    { MCP_ALLOWED_ORIGINS: '["https://example.com/path"]' },
    { MCP_ALLOW_EVALUATE: "true" },
    { MCP_ENABLE_MUTATIONS: "yes" },
    { MCP_STEALTH: "true" },
    { MCP_LOCAL_TEST_ORIGINS: '["http://localhost:8000"]' },
    { GEMINI_CLI_MCP_HEADLESS: "true" },
  ]) {
    assert.throws(() => loadPolicy(env));
  }
});

test("navigation denies private, special, encoded and non-http destinations", async () => {
  const policy = loadPolicy({ MCP_ALLOWED_ORIGINS: '["https://example.com"]' });
  for (const url of [
    "file:///tmp/a",
    "data:text/html,hi",
    "javascript:alert(1)",
    "http://127.1",
    "http://2130706433",
    "http://[::1]",
    "http://169.254.169.254",
    "https://user:pass@example.com",
  ]) {
    await assert.rejects(assertNavigation(url, policy));
  }
  await assert.rejects(
    assertNavigation("https://example.com", policy, async () => [
      { address: "10.0.0.1" },
    ]),
  );
  await assert.rejects(
    assertNavigation("https://example.com", policy, async () => [
      { address: "8.8.8.8" },
      { address: "127.0.0.1" },
    ]),
  );
  assert.equal(
    (
      await assertNavigation("https://example.com", policy, async () => [
        { address: "8.8.8.8" },
      ])
    ).origin,
    "https://example.com",
  );
});

test("DNS is rechecked and local fixtures require exact origin including port", async () => {
  const policy = loadPolicy({
    MCP_ALLOWED_ORIGINS: '["https://example.com"]',
    MCP_LOCAL_TEST_ORIGINS: '["http://127.0.0.1:8000"]',
  });
  await assertNavigation("http://127.0.0.1:8000/fixture", policy);
  await assert.rejects(assertNavigation("http://127.0.0.1:8001", policy));
  let count = 0;
  const resolve = async () => [{ address: count++ ? "127.0.0.1" : "8.8.8.8" }];
  await assertNavigation("https://example.com", policy, resolve);
  await assert.rejects(
    assertNavigation("https://example.com", policy, resolve),
  );
  for (const ip of [
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "224.0.0.1",
    "100.64.0.1",
    "192.168.1.1",
  ])
    assert.equal(isPublicAddress(ip), false);
});

test("file roots are explicit and reads/writes resist traversal and overwrite", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-policy-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const policy = await createFilePolicy({
    readRoots: [root],
    writeRoots: [root],
  });
  await policy.writeText("fixture.txt", "synthetic");
  assert.equal(await policy.readText("fixture.txt"), "synthetic");
  await assert.rejects(policy.writeText("fixture.txt", "overwrite"));
  for (const input of [
    "../escape",
    "a/../../escape",
    "C:escape",
    "/tmp/escape",
    "\\server\\share",
    "file.txt:stream",
    "sub\\escape",
    ".. /escape",
    "NUL",
    "COM1.txt",
    "trailing.",
    "trailing ",
  ]) {
    await assert.rejects(policy.resolveRead(input));
    await assert.rejects(policy.resolveWrite(input));
  }
  await assert.rejects((await createFilePolicy()).readText("fixture.txt"));
  await assert.rejects(policy.readText("fixture.txt", 2));
});

test("file policy rejects linked parents and hard-linked files", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-link-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const inside = path.join(root, "inside");
  const outside = path.join(root, "outside");
  await fs.mkdir(inside);
  await fs.mkdir(outside);
  await fs.symlink(
    outside,
    path.join(inside, "escape"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const policy = await createFilePolicy({
    readRoots: [inside],
    writeRoots: [inside],
  });
  await assert.rejects(policy.resolveWrite("escape/new.txt"));
  await assert.rejects(
    createFilePolicy({ readRoots: [path.join(inside, "escape")] }),
  );
  await fs.writeFile(path.join(outside, "secret"), "fictional");
  await fs.link(path.join(outside, "secret"), path.join(inside, "hard"));
  await assert.rejects(policy.readText("hard"));
});

test("structured and URL redaction excludes sensitive values", () => {
  const result = redact(
    {
      Authorization: "Bearer fictional",
      list: [{ aPi_Key: "fictional" }],
      text: "known-value",
    },
    ["known-value"],
  );
  assert.equal(result.Authorization, "[REDACTED]");
  assert.equal(result.list[0].aPi_Key, "[REDACTED]");
  assert.equal(result.text, "[REDACTED]");
  const url = redactUrl(
    "https://name:pass@example.com/?token=fictional&q=private#secret",
  );
  assert.doesNotMatch(url, /fictional|private|name:pass|#secret/);
});

test("confirmation requires client support, acceptance, and unchanged page URL", async () => {
  await assert.rejects(
    confirmAction(
      { server: { getClientCapabilities: () => ({}) } },
      "browser.click",
      {},
      null,
    ),
  );
  const fake = (result) => ({
    server: {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput: async () => result,
    },
  });
  for (const result of [
    { action: "decline" },
    { action: "cancel" },
    { action: "accept", content: { approve: false } },
  ]) {
    await assert.rejects(
      confirmAction(fake(result), "browser.click", {}, null),
    );
  }
  await confirmAction(
    fake({ action: "accept", content: { approve: true } }),
    "browser.click",
    {},
    null,
  );
  let version = 0;
  await assert.rejects(
    confirmAction(
      fake({ action: "accept", content: { approve: true } }),
      "browser.click",
      {},
      {
        url: () => "https://example.com",
        isClosed: () => false,
        frames: () => [
          {
            url: () => "https://example.com",
            content: async () => `version-${version++}`,
          },
        ],
      },
    ),
    /Page changed during confirmation/,
  );
});
