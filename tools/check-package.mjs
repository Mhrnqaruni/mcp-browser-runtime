import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validatePackageEntries } from "./package-policy.mjs";

// npm run supplies its installed JS entrypoint: no shell launcher or interpolation.
if (!process.env.npm_execpath)
  throw new Error("Run through npm run pack:check");
const result = execFileSync(
  process.execPath,
  [process.env.npm_execpath, "pack", "--dry-run", "--ignore-scripts", "--json"],
  {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, npm_config_update_notifier: "false" },
  },
);
const packs = JSON.parse(result);
if (packs.length !== 1) throw new Error("Expected one package");
const count = validatePackageEntries(packs[0].files);
console.log(
  `Package allowlist passed: ${count} files. No package was published.`,
);
console.log(packs[0].files.map((entry) => entry.path).join("\n"));
