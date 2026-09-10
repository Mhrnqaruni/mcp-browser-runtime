import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

export function startClient(env = {}) {
  const childEnv = {};
  for (const key of [
    "PATH",
    "SystemRoot",
    "SYSTEMROOT",
    "WINDIR",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "LOCALAPPDATA",
    "HOME",
    "PLAYWRIGHT_BROWSERS_PATH",
  ]) {
    if (process.env[key]) childEnv[key] = process.env[key];
  }
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("../src/mcp-browser-server.js", import.meta.url))],
    {
      env: { ...childEnv, ...env },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const pending = new Map();
  const lines = [];
  const violations = [];
  let buffer = "";
  let stderr = "";
  let sequence = 0;
  let confirmation = () => ({ action: "decline" });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const send = (message) => child.stdin.write(JSON.stringify(message) + "\n");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      lines.push(line);
      let message;
      try {
        message = JSON.parse(line);
        if (message.jsonrpc !== "2.0") throw new Error();
      } catch {
        violations.push(line);
        continue;
      }
      if (message.method === "elicitation/create") {
        send({
          jsonrpc: "2.0",
          id: message.id,
          result: confirmation(message.params),
        });
      } else if (pending.has(message.id)) {
        const item = pending.get(message.id);
        pending.delete(message.id);
        clearTimeout(item.timer);
        item.resolve(message);
      }
    }
  });
  const request = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out: ${method} ${params.name ?? ""}`));
      }, 25000);
      pending.set(id, { resolve, reject, timer });
      send({ jsonrpc: "2.0", id, method, params });
    });
  const exitPromise = once(child, "exit");
  return {
    child,
    lines,
    violations,
    get stderr() {
      return stderr;
    },
    request,
    confirm: (callback) => {
      confirmation = callback;
    },
    async initialize(capabilities = {}) {
      const response = await request("initialize", {
        protocolVersion: "2025-11-25",
        clientInfo: { name: "synthetic-test", version: "1.0.0" },
        capabilities,
      });
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      return response;
    },
    call: (name, args = {}) => request("tools/call", { name, arguments: args }),
    async close() {
      child.stdin.end();
      const timer = setTimeout(() => child.kill(), 5000);
      try {
        await exitPromise;
      } finally {
        clearTimeout(timer);
        for (const item of pending.values()) {
          clearTimeout(item.timer);
          item.reject(new Error("Client closed"));
        }
        pending.clear();
      }
      if (buffer.trim()) violations.push(buffer);
    },
  };
}
