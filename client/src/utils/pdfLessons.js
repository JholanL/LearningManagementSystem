// Split extracted PDF text into lesson-sized pieces.
// 1) If it has clear chapter/section headings, split there (title = the heading).
// 2) Otherwise split by size into "Part 1, Part 2, ...".
// Every piece stays within the lesson content limit.

const MAX = 18000; // under the 20,000 server limit, with margin
const HEADING = /^\s*(chapter|section|part|unit|module|lesson)\s+([0-9]+|[ivxlcdm]+)\b/i;

// Tidy a candidate title: collapse spaces, cap length, capitalise.
function tidy(s) {
  const t = s.replace(/\s+/g, ' ').replace(/[.,;:\s]+$/, '').trim().slice(0, 120);
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

// Guess a lesson title from its content when there's no chapter heading:
// a short heading-like first line, else the first sentence (capped to ~9 words).
function deriveTitle(content) {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return '';
  const first = lines[0];
  const words = first.split(/\s+/);
  // 1) First line looks like a heading: short, few words, no sentence-ending punctuation.
  if (first.length <= 70 && words.length <= 10 && !/[.?!]$/.test(first)) return tidy(first);
  // 2) Otherwise take the first sentence, trimmed to the first ~9 words.
  const sentence = (content.match(/[^.?!\n]+/)?.[0] || first).trim();
  const sWords = sentence.split(/\s+/);
  const title = tidy(sWords.slice(0, 9).join(' '));
  return sWords.length > 9 ? `${title}…` : title;
}

// Split one block of text into <=max chunks, preferring paragraph boundaries.
function chunkBySize(text, max) {
  const chunks = [];
  let cur = '';
  for (const para of text.split(/\n{2,}/)) {
    if (para.length > max) {
      if (cur.trim()) { chunks.push(cur.trim()); cur = ''; }
      for (let i = 0; i < para.length; i += max) chunks.push(para.slice(i, i + max));
      continue;
    }
    if (cur && `${cur}\n\n${para}`.length > max) { chunks.push(cur.trim()); cur = ''; }
    cur = cur ? `${cur}\n\n${para}` : para;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

export function splitIntoLessons(text, max = MAX) {
  const lines = text.split('\n');
  const headingIdx = [];
  lines.forEach((ln, i) => {
    const t = ln.trim();
    if (t.length > 0 && t.length <= 80 && HEADING.test(t)) headingIdx.push(i);
  });

  let sections;
  if (headingIdx.length >= 2) {
    sections = headingIdx
      .map((start, k) => {
        const end = k + 1 < headingIdx.length ? headingIdx[k + 1] : lines.length;
        return {
          title: lines[start].trim().replace(/\s+/g, ' ').slice(0, 120),
          content: lines.slice(start + 1, end).join('\n').trim(),
        };
      })
      .filter((s) => s.content);
  } else {
    sections = [{ title: '', content: text }];
  }

  const out = [];
  sections.forEach((s) => {
    const chunks = chunkBySize(s.content, max);
    chunks.forEach((content, ci) => {
      let title;
      if (s.title) title = chunks.length > 1 ? `${s.title} (part ${ci + 1})` : s.title;
      else title = deriveTitle(content) || `Part ${out.length + 1}`;
      out.push({ title: title.slice(0, 120), content });
    });
  });

  if (!out.length && text.trim()) {
    const content = text.slice(0, max);
    out.push({ title: deriveTitle(content) || 'Lesson 1', content });
  }
  return out;
}
