// Tool definitions and handlers; policy/transport enforcement is centralized.
export function registerFilesTools(
  server,
  {
    assertAllowedReadPath,
    assertAllowedWritePath,
    clampNumber,
    ensureDir,
    escapeRegex,
    fs,
    path,
    respond,
    z,
  },
) {
  server.registerTool(
    "files.read_text",
    {
      description:
        "Read text from a file path (restricted to Applied Jobs and Auto output/logs).",
      inputSchema: {
        path: z.string(),
        maxChars: z.number().optional(),
      },
    },
    async ({ path: targetPath, maxChars }) => {
      const absPath = await assertAllowedReadPath(targetPath);

      const stat = await fs.stat(absPath);
      const maxBytes = 2 * 1024 * 1024;
      if (stat.size > maxBytes) {
        throw new Error(
          `File too large to read (${stat.size} bytes). Limit is ${maxBytes} bytes.`,
        );
      }

      const ext = path.extname(absPath).toLowerCase();
      const binaryExts = new Set([
        ".pdf",
        ".doc",
        ".docx",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".gif",
        ".zip",
        ".rar",
        ".7z",
      ]);
      if (binaryExts.has(ext)) {
        if (ext === ".pdf") {
          throw new Error(
            `"${absPath}" is a PDF (binary). Use files.read_pdf_text or provide a CV.md/CV.txt instead.`,
          );
        }
        throw new Error(
          `"${absPath}" is a binary file (${ext}). Provide a text version (.md/.txt) instead.`,
        );
      }

      const text = await fs.readFile(absPath, "utf8");
      const limit = clampNumber(maxChars, 0, 20000, 20000);
      const truncated = text.length > limit;
      const sliced = truncated ? text.slice(0, limit) : text;

      return respond({
        status: "read",
        path: absPath,
        length: text.length,
        truncated,
        text: sliced,
      });
    },
  );

  server.registerTool(
    "files.read_pdf_text",
    {
      description:
        "Extract text from a PDF file (restricted to Applied Jobs and Auto output/logs).",
      inputSchema: {
        path: z.string(),
        maxChars: z.number().optional(),
      },
    },
    async ({ path: targetPath, maxChars }) => {
      const absPath = await assertAllowedReadPath(targetPath);
      const ext = path.extname(absPath).toLowerCase();
      if (ext !== ".pdf") {
        throw new Error(`Not a PDF: ${absPath}`);
      }

      const stat = await fs.stat(absPath);
      const maxBytes = 10 * 1024 * 1024;
      if (stat.size > maxBytes) {
        throw new Error(
          `PDF too large (${stat.size} bytes). Limit is ${maxBytes} bytes.`,
        );
      }

      const data = await fs.readFile(absPath);
      let pdfParse;
      try {
        const mod = await import("pdf-parse");
        pdfParse = mod?.default || mod;
      } catch (err) {
        const msg =
          err && typeof err === "object" && "message" in err
            ? String(err.message)
            : String(err);
        throw new Error(
          `PDF parsing dependency is missing or failed to load. Install "pdf-parse". Details: ${msg}`,
        );
      }

      const result = await pdfParse(data);
      const raw = String(result?.text || "");
      const cleaned = raw
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .trim();
      const limit = clampNumber(maxChars, 0, 20000, 20000);
      const truncated = cleaned.length > limit;
      const sliced = truncated ? cleaned.slice(0, limit) : cleaned;

      return respond({
        status: "read",
        path: absPath,
        pages: result?.numpages ?? null,
        length: cleaned.length,
        truncated,
        text: sliced,
      });
    },
  );

  server.registerTool(
    "files.list_dir",
    {
      description:
        "List files in an allowed directory (Applied Jobs, Auto/output, Auto/logs).",
      inputSchema: {
        path: z.string(),
        pattern: z.string().optional(),
        recursive: z.boolean().optional(),
        maxDepth: z.number().optional(),
        limit: z.number().optional(),
        includeDirs: z.boolean().optional(),
      },
    },
    async ({
      path: targetPath,
      pattern,
      recursive,
      maxDepth,
      limit,
      includeDirs,
    }) => {
      const absPath = await assertAllowedReadPath(targetPath);
      const stat = await fs.stat(absPath);
      if (!stat.isDirectory()) {
        throw new Error(`Not a directory: ${absPath}`);
      }

      const wantRecursive = recursive ?? false;
      const depthLimit = wantRecursive ? clampNumber(maxDepth, 0, 10, 2) : 0;
      const maxItems = clampNumber(limit, 1, 2000, 200);
      const includeDirectories = includeDirs ?? false;

      let matcher = null;
      if (pattern) {
        // Treat pattern as a glob (supports * and ?). Match against basename.
        const escaped = escapeRegex(pattern)
          .replace(/\\\*/g, ".*")
          .replace(/\\\?/g, ".");
        matcher = new RegExp(`^${escaped}$`, "i");
      }

      const items = [];
      const walk = async (dir, depth) => {
        if (items.length >= maxItems) return;
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (items.length >= maxItems) return;
          const full = path.join(dir, entry.name);
          const rel = path.relative(absPath, full);
          const isDir = entry.isDirectory();
          const isFile = entry.isFile();

          if (matcher && !matcher.test(entry.name)) {
            if (isDir && depth < depthLimit) {
              await walk(full, depth + 1);
            }
            continue;
          }

          if (isFile || (isDir && includeDirectories)) {
            let size = null;
            if (isFile) {
              try {
                const s = await fs.stat(full);
                size = s.size;
              } catch {
                size = null;
              }
            }
            items.push({
              relPath: rel.replace(/\\/g, "/"),
              name: entry.name,
              kind: isDir ? "dir" : "file",
              sizeBytes: size,
            });
          }

          if (isDir && depth < depthLimit) {
            await walk(full, depth + 1);
          }
        }
      };

      await walk(absPath, 0);

      return respond({
        status: "listed",
        path: absPath,
        recursive: wantRecursive,
        maxDepth: depthLimit,
        pattern: pattern || null,
        count: items.length,
        items,
      });
    },
  );

  server.registerTool(
    "files.write_text",
    {
      description: "Write arbitrary text to a file path.",
      inputSchema: {
        path: z.string(),
        text: z.string(),
      },
    },
    async ({ path: targetPath, text }) => {
      const absPath = await assertAllowedWritePath(targetPath);
      await ensureDir(absPath);
      await fs.writeFile(absPath, text, "utf8");
      return respond({ status: "written", path: absPath, length: text.length });
    },
  );
}
