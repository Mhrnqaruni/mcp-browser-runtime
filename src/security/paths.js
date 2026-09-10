import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { jsonList } from "./config.js";

const denied = () =>
  new Error("File access denied by configured roots or file policy");
const within = (root, target) => {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
};

async function noLinks(target, allowMissingLeaf = false) {
  const absolute = path.resolve(target);
  let cursor = path.parse(absolute).root;
  const parts = absolute.slice(cursor.length).split(path.sep).filter(Boolean);
  for (let index = 0; index < parts.length; index++) {
    cursor = path.join(cursor, parts[index]);
    let stat;
    try {
      stat = await fs.lstat(cursor);
    } catch (error) {
      if (
        error.code === "ENOENT" &&
        allowMissingLeaf &&
        index === parts.length - 1
      )
        return;
      throw denied();
    }
    if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink !== 1))
      throw denied();
  }
}

export async function createFilePolicy({
  readRoots = [],
  writeRoots = [],
} = {}) {
  if (readRoots.length > 1 || writeRoots.length > 1) throw denied();
  const canonicalize = async (roots) =>
    Promise.all(
      roots.map(async (root) => {
        if (!path.isAbsolute(root) || root.startsWith("\\\\")) throw denied();
        await noLinks(root);
        if (!(await fs.stat(root)).isDirectory()) throw denied();
        return fs.realpath(root);
      }),
    );
  const reads = await canonicalize(readRoots);
  const writes = await canonicalize(writeRoots);
  const resolve = async (raw, roots, write = false) => {
    if (
      typeof raw !== "string" ||
      !raw ||
      raw.includes("\0") ||
      raw.includes("\\") ||
      raw.startsWith("/") ||
      raw.includes(":") ||
      raw.split("/").includes("..")
    )
      throw denied();
    if (roots.length !== 1) throw denied();
    if (
      raw
        .split("/")
        .some(
          (part) =>
            !part ||
            part === "." ||
            part.trim() !== part ||
            part.endsWith(".") ||
            /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
        )
    )
      throw denied();
    const target = path.resolve(roots[0], raw);
    if (!within(roots[0], target) || (write && target === roots[0]))
      throw denied();
    await noLinks(target, write);
    const checked = await fs.realpath(write ? path.dirname(target) : target);
    if (!within(roots[0], checked)) throw denied();
    return target;
  };
  return {
    resolveRead: (raw) => resolve(raw, reads),
    resolveWrite: (raw) => resolve(raw, writes, true),
    async readBytes(raw, maxBytes = 1024 * 1024) {
      const target = await resolve(raw, reads);
      const handle = await fs.open(
        target,
        constants.O_RDONLY | (constants.O_NOFOLLOW || 0),
      );
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.nlink !== 1 || stat.size > maxBytes)
          throw denied();
        const bytes = Buffer.alloc(maxBytes + 1);
        let total = 0;
        while (total < bytes.length) {
          const { bytesRead } = await handle.read(
            bytes,
            total,
            bytes.length - total,
            total,
          );
          if (!bytesRead) break;
          total += bytesRead;
        }
        if (total > maxBytes) throw denied();
        return bytes.subarray(0, total);
      } finally {
        await handle.close();
      }
    },
    async readText(raw, maxBytes = 1024 * 1024) {
      return (await this.readBytes(raw, maxBytes)).toString("utf8");
    },
    async writeBytes(raw, bytes, maxBytes = 1024 * 1024) {
      if (!Buffer.isBuffer(bytes) || bytes.length > maxBytes) throw denied();
      const target = await resolve(raw, writes, true);
      const handle = await fs.open(
        target,
        constants.O_CREAT |
          constants.O_EXCL |
          constants.O_WRONLY |
          (constants.O_NOFOLLOW || 0),
        0o600,
      );
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      return raw;
    },
    async writeText(raw, text) {
      return this.writeBytes(raw, Buffer.from(text, "utf8"));
    },
  };
}

let policy;
export function configuredFilePolicy() {
  policy ??= createFilePolicy({
    readRoots: jsonList(process.env, "MCP_READ_ROOTS"),
    writeRoots: jsonList(process.env, "MCP_WRITE_ROOTS"),
  });
  return policy;
}
export async function assertAllowedReadPath(raw) {
  return (await configuredFilePolicy()).resolveRead(raw);
}
export async function assertAllowedWritePath(raw) {
  return (await configuredFilePolicy()).resolveWrite(raw);
}
