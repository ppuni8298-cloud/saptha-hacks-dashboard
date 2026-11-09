// Browser-only PDF text extraction with PDF.js (loaded lazily).
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let out = "";
  for (let i = 1; i <= Math.min(doc.numPages, 60); i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    out += `\n[Page ${i}]\n` + tc.items.map((it: any) => it.str).join(" ");
    if (out.length > 60000) break;
  }
  return out.replace(/[ \t]+/g, " ").trim();
}
