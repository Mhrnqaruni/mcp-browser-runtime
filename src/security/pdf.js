import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export async function parsePdfBytes(bytes, { timeout = 10000 } = {}) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length > 1024 * 1024 ||
    bytes.subarray(0, 5).toString() !== "%PDF-"
  )
    throw new Error("Unsupported PDF input");
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 10000)
    throw new Error("Invalid parser timeout");
  return new Promise((resolve, reject) => {
    const env = {};
    for (const key of ["SYSTEMROOT", "SystemRoot", "WINDIR", "TEMP", "TMP"])
      if (process.env[key]) env[key] = process.env[key];
    const child = spawn(
      process.execPath,
      [
        "--max-old-space-size=128",
        fileURLToPath(new URL("./pdf-worker.js", import.meta.url)),
      ],
      {
        env,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let output = "";
    let count = 0;
    let failed = false;
    const fail = () => {
      failed = true;
      child.kill();
    };
    const timer = setTimeout(fail, timeout);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      count += Buffer.byteLength(chunk);
      if (count > 256 * 1024) fail();
      else output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      count += chunk.length;
      if (count > 256 * 1024) fail();
    });
    child.on("error", () => {
      clearTimeout(timer);
      reject(new Error("PDF parser failed"));
    });
    child.stdin.on("error", fail);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (failed || code !== 0) {
        reject(
          new Error(
            `PDF parser failed or exceeded limits (exit=${code}, outputBytes=${count})`,
          ),
        );
        return;
      }
      try {
        const parsed = JSON.parse(output);
        if (
          parsed.ok !== true ||
          typeof parsed.text !== "string" ||
          parsed.text.length > 20000
        )
          throw new Error();
        resolve(parsed);
      } catch {
        reject(new Error("Malformed, encrypted or unsupported PDF"));
      }
    });
    child.stdin.end(bytes);
  });
}
