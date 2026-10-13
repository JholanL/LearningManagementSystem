// Server-authoritative matching for Call Simulator answers (text or voice).
// Two separate ideas:
//   1) SELECTION — which option did the agent most likely intend? Lenient overlap
//      (relative to the shorter phrase) + keyword bonus + "option A/B" commands, so
//      paraphrases map to the right branch.
//   2) QUALITY (0..1) — how COMPLETELY did their answer cover that option? Coverage of
//      the option's distinctive words + its keywords. This scales the awarded score, so
//      a few matching words no longer earns the full 10.

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'is', 'are', 'am', 'was', 'were', 'be', 'been',
  'to', 'of', 'in', 'on', 'for', 'with', 'at', 'by', 'from', 'as', 'that', 'this', 'it', 'i', 'you',
  'your', 'my', 'me', 'we', 'he', 'she', 'they', 'so', 'may', 'can', 'will', 'would', 'could', 'do',
  'did', 'have', 'has', 'had', 'please', 'okay', 'ok', 'um', 'uh', 'let', 'us', 'now', 'here',
]);

const normalize = (text = '') =>
  String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenSet = (text = '') => {
  const set = new Set();
  for (const w of normalize(text).split(' ')) if (w && !STOP_WORDS.has(w)) set.add(w);
  return set;
};

function intersection(a, b) {
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n;
}

const LETTER = { a: 0, b: 1, c: 2, d: 3 };
function commandIndex(spoken, count) {
  const n = normalize(spoken);
  let m = n.match(/\b(?:option|letter|choice|number|pick|select)\s+([a-d]|[1-9])\b/);
  if (!m) m = n.match(/^([a-d])$/);
  if (!m) return -1;
  const idx = m[1] in LETTER ? LETTER[m[1]] : parseInt(m[1], 10) - 1;
  return idx >= 0 && idx < count ? idx : -1;
}

// How fully the text covers one option (0..1): keyword coverage (weighted) + word coverage.
function optionQuality(text, option) {
  const T = tokenSet(text);
  const OT = tokenSet(option.text);
  const cov = OT.size ? intersection(T, OT) / OT.size : 0;
  const kws = (option.keywords || []).map(normalize).filter(Boolean);
  if (!kws.length) return Math.max(0, Math.min(1, cov));
  const nText = normalize(text);
  const kwCov = kws.filter((k) => nText.includes(k)).length / kws.length;
  return Math.max(0, Math.min(1, 0.6 * kwCov + 0.4 * cov));
}

// Pick the intended option + its coverage quality.
// Returns { index, quality, viaCommand } or null when there's no usable signal.
function matchOption(text, options) {
  if (!options.length) return null;
  const spoken = String(text || '');
  const cmd = commandIndex(spoken, options.length);
  if (cmd !== -1) return { index: cmd, quality: 1, viaCommand: true };

  const spokenSet = tokenSet(spoken);
  const nText = normalize(spoken);
  let best = null;
  options.forEach((opt, i) => {
    const optSet = tokenSet(opt.text);
    const inter = intersection(spokenSet, optSet);
    const denom = Math.max(1, Math.min(spokenSet.size, optSet.size));
    let sel = inter / denom; // lenient selection score
    for (const k of opt.keywords || []) { if (normalize(k) && nText.includes(normalize(k))) sel += 0.2; }
    if (!best || sel > best.sel) best = { index: i, sel, option: opt };
  });
  if (!best || best.sel <= 0) return null;
  return { index: best.index, quality: optionQuality(spoken, best.option), viaCommand: false };
}

module.exports = { matchOption, optionQuality };
