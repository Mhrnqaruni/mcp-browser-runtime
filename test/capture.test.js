import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { enforcePayloadCeiling } from "../src/browser/payload-budget.js";

for (const name of ["capture-profiles-test.js", "payload-budget-test.js"]) {
  test(`retained assertions: ${name}`, () => {
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL(`./legacy/${name}`, import.meta.url))],
      { timeout: 15000, windowsHide: true },
    );
  });
}
test("payload limits reject circular/BigInt and bound nested/binary/Unicode data", () => {
  const circular = {};
  circular.self = circular;
  assert.throws(() => enforcePayloadCeiling(circular));
  assert.throws(() => enforcePayloadCeiling({ value: 1n }));
  for (const payload of [
    {
      items: Array.from({ length: 1000 }, () => ({ text: "界".repeat(1000) })),
    },
    { data: Buffer.alloc(20000) },
    { text: "🙂".repeat(20000) },
  ]) {
    const result = enforcePayloadCeiling(payload, { maxBytes: 4096 });
    assert.ok(Buffer.byteLength(JSON.stringify(result.payload)) <= 4096);
    assert.equal(result.truncated, true);
  }
});
