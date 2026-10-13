// Extract plain text from many file types, entirely in the browser (nothing is uploaded).
// Supported: PDF, Word (.docx), PowerPoint (.pptx), plain text (.txt/.md/.csv),
// and images/screenshots (.png/.jpg/...) via on-device OCR.
// The heavy parsers (jszip, tesseract) are loaded on demand so they don't bloat the main bundle.
import { extractPdfText } from './pdfText';

// Normalise whitespace the way the PDF extractor does, so every source looks the same.
function cleanText(s) {
  return String(s || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&'); // last, so decoded text can't re-trigger an entity
}

// Word .docx — the body text lives in word/document.xml.
async function extractDocx(file) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('That does not look like a valid .docx file.');
  const xml = await doc.async('string');
  const text = xml
    .replace(/<w:tab\b[^>]*\/?>/g, '\t')
    .replace(/<w:br\b[^>]*\/?>/g, '\n')
    .replace(/<\/w:p>/g, '\n') // each paragraph on its own line
    .replace(/<[^>]+>/g, ''); // drop all tags; the text nodes (incl. <w:t>) remain
  return cleanText(decodeXmlEntities(text));
}

// PowerPoint .pptx — one XML per slide; visible text is in <a:t> runs.
async function extractPptx(file) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideNum = (n) => Number((n.match(/slide(\d+)\.xml$/) || [])[1] || 0);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNum(a) - slideNum(b));
  if (!slides.length) throw new Error('No slides with text were found in that .pptx file.');
  const parts = [];
  for (const name of slides) {
    // eslint-disable-next-line no-await-in-loop
    const xml = await zip.file(name).async('string');
    const t = xml
      .replace(/<a:br\b[^>]*\/?>/g, '\n')
      .replace(/<\/a:p>/g, '\n')
      .replace(/<[^>]+>/g, '');
    const clean = cleanText(decodeXmlEntities(t));
    if (clean) parts.push(clean);
  }
  return parts.join('\n\n');
}

// Images / screenshots — OCR with tesseract.js (loads the engine on first use).
async function extractImage(file, onProgress) {
  const Tesseract = (await import('tesseract.js')).default;
  const { data } = await Tesseract.recognize(file, 'eng', {
    logger: onProgress
      ? (m) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') onProgress(Math.round(m.progress * 100));
        }
      : undefined,
  });
  return cleanText(data?.text || '');
}

// Human-readable list for the file picker and messages.
export const SUPPORTED_FILE_HINT = 'PDF, Word (.docx), PowerPoint (.pptx), text (.txt/.md), or an image';
export const SUPPORTED_ACCEPT =
  '.pdf,.docx,.pptx,.txt,.md,.markdown,.csv,.log,.png,.jpg,.jpeg,.webp,.bmp,.gif,' +
  'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,image/*';

// Dispatch by type/extension. `onProgress(percent)` is only called for image OCR.
export async function extractFileText(file, onProgress) {
  const name = (file.name || '').toLowerCase();
  const type = file.type || '';
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';

  if (type === 'application/pdf' || ext === 'pdf') return extractPdfText(file);
  if (type.startsWith('text/') || ['txt', 'md', 'markdown', 'csv', 'log'].includes(ext)) return cleanText(await file.text());
  if (ext === 'docx' || type.includes('wordprocessingml')) return extractDocx(file);
  if (ext === 'pptx' || type.includes('presentationml')) return extractPptx(file);
  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext)) return extractImage(file, onProgress);

  if (ext === 'doc' || ext === 'ppt') {
    throw new Error('Old .doc/.ppt format is not supported — save as .docx/.pptx or PDF.');
  }
  throw new Error(`Unsupported file type. Use ${SUPPORTED_FILE_HINT}.`);
}

// True for file types that need OCR (so the UI can warn it may take a few seconds).
export function isImageFile(file) {
  const name = (file.name || '').toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
  return (file.type || '').startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext);
}
