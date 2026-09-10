import { PDFParse } from "pdf-parse";

const chunks = [];
let size = 0;
process.stdin.on("data", (chunk) => {
  size += chunk.length;
  if (size > 1024 * 1024) process.exit(2);
  chunks.push(chunk);
});
process.stdin.on("end", async () => {
  let parser;
  try {
    parser = new PDFParse({
      data: new Uint8Array(Buffer.concat(chunks)),
      isEvalSupported: false,
      useSystemFonts: false,
      verbosity: 0,
      stopAtErrors: true,
    });
    const info = await parser.getInfo();
    if (!Number.isInteger(info.total) || info.total > 50)
      throw new Error("Page limit");
    const result = await parser.getText();
    const text = result.text.replace(/\r\n/g, "\n");
    process.stdout.write(
      JSON.stringify({
        ok: true,
        pages: info.total,
        text: text.slice(0, 20000),
        truncated: text.length > 20000,
      }),
    );
  } catch {
    process.stdout.write(JSON.stringify({ ok: false }));
  } finally {
    await parser?.destroy().catch(() => {});
  }
});
