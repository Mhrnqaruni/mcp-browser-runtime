import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  packagePathAllowed,
  validatePackageEntries,
} from "../tools/package-policy.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (name) =>
  readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const manifest = JSON.parse(read("package.json"));

test("package publication is blocked and distribution paths are explicit", () => {
  assert.equal(manifest.private, true);
  assert.deepEqual(manifest.files, [
    "src/*.js",
    "src/browser/*.js",
    "src/security/*.js",
    "src/server/*.js",
    "src/tools/*.js",
    "docs/*.md",
    "LICENSE",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "CHANGELOG.md",
  ]);
  assert.doesNotMatch(manifest.description, /production-grade/i);
  assert.ok(!manifest.scripts.preinstall && !manifest.scripts.postinstall);
});

test("root lockfile metadata matches manifest without relaxing dependencies", () => {
  const lock = JSON.parse(read("package-lock.json"));
  assert.equal(lock.version, manifest.version);
  assert.equal(lock.packages[""].version, manifest.version);
  assert.deepEqual(lock.packages[""].dependencies, manifest.dependencies);
});

test("retired installer, prompts and launchers are absent from working tree", () => {
  for (const name of [
    "install.bat",
    "GEMINI.md",
    "report.md",
    "scripts/GEMINI.md",
    "scripts/autoconnect.js",
    "scripts/.gemini/settings.json",
  ]) {
    assert.equal(
      existsSync(new URL(`../${name}`, import.meta.url)),
      false,
      `Retired artifact: ${name}`,
    );
  }
  assert.equal(
    readdirSync(root).some((name) => /(?:cv|europass)/i.test(name)),
    false,
  );
  assert.equal(
    readdirSync(new URL("../scripts/", import.meta.url)).some((name) =>
      /\.bat$/i.test(name),
    ),
    false,
  );
});

test("runtime state is ignored without hiding legitimate fixture extensions", () => {
  const names = [
    ".mcp-data/auth/state.json",
    "browser-profiles/example/state",
    "scripts/.gemini/settings.json",
    "downloads/example.bin",
  ];
  const ignored = execFileSync(
    "git",
    ["check-ignore", "--no-index", "--stdin"],
    {
      cwd: root,
      input: names.join("\n") + "\n",
      encoding: "utf8",
      timeout: 10000,
      windowsHide: true,
    },
  )
    .trim()
    .split(/\r?\n/);
  assert.deepEqual(ignored, names);
  assert.doesNotMatch(read(".gitignore"), /^\*\.(?:html|txt|cjs)$/m);
});

test("package policy rejects sensitive, test and traversal paths", () => {
  for (const name of [
    ".env",
    ".mcp-data/auth/state.json",
    "profiles/system.md",
    "scripts/.gemini/settings.json",
    "src/tests/example.js",
    "test/fixture.html",
    "src/../private.js",
    "/src/runtime.js",
    "src\\runtime.js",
    "logs/example.log",
    "browser-profiles/state.json",
  ])
    assert.equal(packagePathAllowed(name), false, name);
});

test("package inspection requires runtime files and rejects poisoned manifests", () => {
  const entries = [
    "package.json",
    "README.md",
    "LICENSE",
    "src/mcp-browser-server.js",
  ].map((path) => ({ path }));
  assert.equal(validatePackageEntries(entries), 4);
  assert.throws(() => validatePackageEntries([]));
  assert.throws(() => validatePackageEntries(entries.slice(1)));
  assert.throws(() => validatePackageEntries([...entries, entries[0]]));
  assert.throws(() =>
    validatePackageEntries([...entries, { path: ".mcp-data/auth/state.json" }]),
  );
});

test("README preserves unresolved privacy and runtime caveats", () => {
  const text = read("README.md");
  assert.match(text, /Historical personal material remains/);
  assert.match(text, /does \*\*not\*\* finish runtime hardening/);
  assert.doesNotMatch(
    text,
    /3[–-]4x faster|8x fewer tokens|hardest for sites to detect/i,
  );
});
