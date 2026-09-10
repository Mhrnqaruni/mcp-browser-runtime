import test from "node:test";
import assert from "node:assert/strict";
import { closeManagedSession } from "../src/browser/managed-session.js";

test("shutdown revokes proxy before closing the owned browser and clears failed state", async () => {
  const calls = [];
  const state = {
    networkProxy: { close: async () => calls.push("proxy") },
    browser: {
      close: async () => {
        calls.push("browser");
        throw new Error("Synthetic close failure");
      },
    },
    context: {},
    page: {},
    pageManager: { reset: () => calls.push("reset") },
  };
  await assert.rejects(closeManagedSession(state), /Synthetic close failure/);
  assert.deepEqual(calls, ["proxy", "browser", "reset"]);
  assert.equal(state.browser, null);
  assert.equal(state.context, null);
  assert.equal(state.networkProxy, null);
  await closeManagedSession(state);
});
