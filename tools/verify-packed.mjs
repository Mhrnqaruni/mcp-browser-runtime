import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (!process.env.npm_execpath) throw new Error("Use npm run pack:verify");
const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-package-check-"));
const resolved = fs.realpathSync(temporary);
if (!resolved.startsWith(fs.realpathSync(os.tmpdir()) + path.sep))
  throw new Error("Unexpected temporary root");
const env = { ...process.env, npm_config_update_notifier: "false" };
for (const key of Object.keys(env))
  if (key.startsWith("MCP_") || key.startsWith("GEMINI_CLI_MCP_"))
    delete env[key];
const npm = (args) =>
  execFileSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
try {
  const [pack] = JSON.parse(
    npm([
      "pack",
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      temporary,
    ]),
  );
  if (path.basename(pack.filename) !== pack.filename)
    throw new Error("Unexpected tarball filename");
  const install = path.join(temporary, "install");
  fs.mkdirSync(install);
  npm([
    "install",
    "--ignore-scripts",
    "--no-fund",
    "--no-audit",
    "--prefix",
    install,
    path.join(temporary, pack.filename),
  ]);
  const executable = path.join(
    install,
    "node_modules/mcp-browser-runtime/src/cli.js",
  );
  const result = execFileSync(process.execPath, [executable, "doctor"], {
    cwd: temporary,
    env,
    encoding: "utf8",
    timeout: 30000,
    windowsHide: true,
  });
  if (JSON.parse(result).status !== "ok")
    throw new Error("Packed doctor failed");
  npm(["audit", "--omit=dev", "--prefix", install]);
  console.log(
    "Packed artifact installed outside checkout: MCP doctor passed; dependency audit passed. No package published.",
  );
} finally {
  if (fs.realpathSync(temporary) !== resolved) {
    console.error("Temporary directory changed; cleanup refused");
    process.exitCode = 1;
  } else fs.rmSync(resolved, { recursive: true, force: true });
}
