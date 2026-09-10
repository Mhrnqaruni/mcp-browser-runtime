import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeSessionTool } from "../src/browser/session-secrets.js";
import { loadPolicy } from "../src/security/config.js";
import { toolPolicy } from "../src/security/capabilities.js";

test("session capability requires operator flag and mutation confirmation surface", () => {
  const policy = loadPolicy({ MCP_ENABLE_SESSION_SECRETS: "true" });
  assert.equal(toolPolicy("browser.get_cookies", policy).enabled, false);
  const enabled = loadPolicy({
    MCP_ENABLE_SESSION_SECRETS: "true",
    MCP_ENABLE_MUTATIONS: "true",
  });
  assert.equal(toolPolicy("browser.get_cookies", enabled).confirmation, true);
  assert.equal(toolPolicy("browser.get_cookies", enabled).enabled, true);
});

test("cookie listing defaults to metadata; export is exclusive and never inline", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-auth-fixture-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const authDir = path.join(root, ".mcp-data", "auth");
  await fs.mkdir(authDir, { recursive: true });
  const cookies = [
    {
      name: "synthetic-session",
      value: "fictional-secret",
      domain: "example.com",
    },
  ];
  const state = {
    context: {
      cookies: async () => cookies,
      storageState: async () => ({ cookies, origins: [] }),
    },
  };
  const policy = {
    sessionSecrets: true,
    authDir,
    origins: ["https://example.com"],
    localOrigins: [],
  };
  const metadata = await executeSessionTool(
    "browser.get_cookies",
    {},
    state,
    policy,
  );
  assert.equal(metadata.cookies[0].value, undefined);
  const values = await executeSessionTool(
    "browser.get_cookies",
    { includeValues: true },
    state,
    policy,
  );
  assert.equal(values.cookies[0].value, "fictional-secret");
  await assert.rejects(
    executeSessionTool(
      "browser.export_storage_state",
      { path: "fixture.json", includeData: true },
      state,
      policy,
    ),
  );
  const result = await executeSessionTool(
    "browser.export_storage_state",
    { path: "fixture.json" },
    state,
    policy,
  );
  assert.doesNotMatch(JSON.stringify(result), /fictional-secret|storageState/);
  assert.ok(!JSON.stringify(result).includes(root));
  await assert.rejects(
    executeSessionTool(
      "browser.export_storage_state",
      { path: "fixture.json" },
      state,
      policy,
    ),
  );
  await assert.rejects(
    executeSessionTool(
      "browser.export_storage_state",
      { path: "../escape.json" },
      state,
      policy,
    ),
  );
  if (process.platform !== "win32")
    assert.equal(
      (await fs.stat(path.join(authDir, "fixture.json"))).mode & 0o777,
      0o600,
    );
});
