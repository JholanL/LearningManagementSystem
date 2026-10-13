// Deterministic, offline lesson formatter — NO AI, NO network, always available.
// Turns raw/plain (e.g. PDF-extracted) text into readable Markdown:
//   - reflows walls of text into short paragraphs,
//   - promotes clear heading lines and leading ALL-CAPS phrases to "## " sections,
//   - normalises bullet markers (•, -, *, "o ", "1.") to "- ".
// It is conservative: when unsure it leaves text as a paragraph rather than guessing,
// so the result is predictable. Trainers can still fine-tune with Markdown by hand.

const BULLET_RE = /^\s*(?:[•▪◦·*]|[-–—]|o(?=\s)|\d+[.)]|[A-Za-z][.)])\s+/;

function isHeadingLine(l) {
  if (l.length < 2 || l.length > 70) return false;
  const words = l.split(/\s+/);
  if (words.length > 9) return false;
  if (/[.,;]$/.test(l)) return false; // sentences end with punctuation
  const letters = (l.match(/[A-Za-z]/g) || []).length;
  if (letters < 2) return false;
  const uppers = (l.match(/[A-Z]/g) || []).length;
  if (uppers / letters > 0.7) return true; // mostly ALL CAPS
  if (/[:?]$/.test(l)) return true; // ends with : or ?
  const capStarts = words.filter((w) => /^[A-Z0-9]/.test(w)).length;
  return words.length <= 7 && capStarts >= Math.ceil(words.length * 0.7); // short Title Case
}

function splitSentences(text) {
  return text.match(/[^.!?]*[.!?]+(?:["')\]]+)?\s*|[^.!?]+$/g) || [text];
}

// Break a long run-on block into ~4-sentence paragraphs.
function reflow(text) {
  const sentences = splitSentences(text).map((s) => s.trim()).filter(Boolean);
  const paras = [];
  for (let i = 0; i < sentences.length; i += 4) paras.push(sentences.slice(i, i + 4).join(' '));
  return paras.length ? paras : [text.trim()];
}

// Pull a leading ALL-CAPS heading (2+ caps words) off the front of a paragraph,
// e.g. "INTRODUCTION TO CALL CENTERS Industry term referring to..." → heading + rest.
function leadingHeading(line) {
  const m = line.match(
    /^((?:[A-Z][A-Z0-9&'/-]*)(?:\s+(?:[A-Z][A-Z0-9&'/-]*|OF|TO|AND|OR|IN|ON|FOR|THE|A|AN|IS|&)){1,8}\??)\s+(?=[A-Z][a-z])/
  );
  if (!m) return null;
  const heading = m[1].trim();
  if (heading.length < 6 || heading.length > 70) return null;
  return { heading, rest: line.slice(m[0].length).trim() };
}

export function formatLessonText(raw) {
  const text = String(raw || '').replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(/ {2,}/g, ' ').trim();
  if (!text) return '';
  // Already has Markdown structure → just tidy blank lines, don't re-guess.
  if (/^#{1,6}\s+/m.test(text) || /^\s*[-*]\s+/m.test(text)) {
    return text.replace(/\n{3,}/g, '\n\n').trim();
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const out = [];
  const pushHeading = (h) => out.push('', `## ${h.replace(/[?:]+$/, '').trim()}`, '');
  const pushPara = (p) => out.push(p, '');

  for (const line of lines) {
    if (BULLET_RE.test(line)) { out.push(line.replace(BULLET_RE, '- ')); continue; }
    if (isHeadingLine(line)) { pushHeading(line); continue; }
    const lh = leadingHeading(line);
    if (lh) { pushHeading(lh.heading); reflow(lh.rest).forEach(pushPara); continue; }
    reflow(line).forEach(pushPara);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
