import test from "node:test";
import assert from "node:assert/strict";
import { parsePdfBytes } from "../src/security/pdf.js";

function syntheticPdf() {
  const stream = "BT /F1 12 Tf 72 720 Td (Synthetic PDF fixture) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let text = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(text));
    text += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(text);
  text += "xref\n0 6\n0000000000 65535 f \n";
  for (const offset of offsets.slice(1))
    text += `${String(offset).padStart(10, "0")} 00000 n \n`;
  return Buffer.from(
    text + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
}

test("isolated PDF parser extracts synthetic text and rejects invalid/oversized input", async () => {
  const result = await parsePdfBytes(syntheticPdf());
  assert.equal(result.pages, 1);
  assert.match(result.text, /Synthetic PDF fixture/);
  await assert.rejects(parsePdfBytes(Buffer.from("not a PDF")));
  await assert.rejects(parsePdfBytes(Buffer.from("%PDF-1.4\nmalformed")));
  await assert.rejects(parsePdfBytes(Buffer.alloc(1024 * 1024 + 1)));
  await assert.rejects(parsePdfBytes(syntheticPdf(), { timeout: 1 }));
  assert.match((await parsePdfBytes(syntheticPdf())).text, /Synthetic/);
});
