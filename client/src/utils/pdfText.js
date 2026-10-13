import * as pdfjsLib from 'pdfjs-dist';
// Vite bundles the pdf.js worker as a real (module) worker; use its port.
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker();

// Extract plain text from a PDF File/Blob, entirely in the browser (no upload/storage).
export async function extractPdfText(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const page = await pdf.getPage(i);
    // eslint-disable-next-line no-await-in-loop
    const content = await page.getTextContent();
    text += `${content.items.map((it) => it.str || '').join(' ')}\n`;
  }
  return text
    .replace(/(\p{L})-\s+(\p{L})/gu, '$1$2') // join line-break hyphenations: "dis- covered" -> "discovered"
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
