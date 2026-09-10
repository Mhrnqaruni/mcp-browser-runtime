import test from "node:test";
import assert from "node:assert/strict";
import { startClient } from "./stdio-client.js";

test("real stdio entrypoint initializes, lists, calls, rejects and closes without stdout pollution", async (t) => {
  const client = startClient();
  t.after(() => client.close());
  const initialized = await client.initialize();
  assert.equal(initialized.result.serverInfo.version, "2.0.0");
  const list = await client.request("tools/list");
  const names = list.result.tools.map((tool) => tool.name);
  assert.ok(names.includes("browser.snapshot"));
  for (const tool of list.result.tools)
    assert.equal(typeof tool.annotations.readOnlyHint, "boolean");
  for (const name of [
    "browser.evaluate",
    "browser.get_cookies",
    "files.read_text",
    "browser.connect_cdp",
    "browser.click",
  ])
    assert.ok(!names.includes(name));
  const profile = await client.call("browser.get_capture_profile");
  assert.ok(!profile.result.isError);
  assert.match(profile.result.content[0].text, /light/);
  const schemaError = await client.call("browser.set_capture_profile", {
    profile: "invalid",
  });
  assert.ok(schemaError.error || schemaError.result.isError);
  const failed = await client.call("browser.snapshot");
  assert.equal(failed.result.isError, true);
  const denied = await client.call("browser.get_cookies");
  assert.ok(denied.error || denied.result.isError);
  assert.deepEqual(client.violations, []);
});

test("mutation request fails when client has no confirmation capability", async (t) => {
  const client = startClient({ MCP_ENABLE_MUTATIONS: "true" });
  t.after(() => client.close());
  await client.initialize();
  const result = await client.call("browser.click", { selector: "#submit" });
  assert.equal(result.result.isError, true);
  assert.deepEqual(client.violations, []);
});
