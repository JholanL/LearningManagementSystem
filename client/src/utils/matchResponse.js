// Match an agent's spoken answer to one of the scenario's response options.
// Overlap coefficient (how much of the short spoken phrase matches the option's
// distinctive words) + a bonus per option keyword spoken, plus a direct
// "option A / letter B / number 2" shortcut.
// Returns { best, candidates, confident, viaCommand }.

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'is', 'are', 'am', 'was', 'were', 'be', 'been',
  'to', 'of', 'in', 'on', 'for', 'with', 'at', 'by', 'from', 'as', 'that', 'this', 'it', 'i', 'you',
  'your', 'my', 'me', 'we', 'he', 'she', 'they', 'so', 'may', 'can', 'will', 'would', 'could', 'do',
  'did', 'have', 'has', 'had', 'please', 'okay', 'ok', 'um', 'uh',
]);

const AUTO_THRESHOLD = 0.4; // minimum best score to auto-select
const LEAD_MARGIN = 0.12; // best must beat runner-up by this much
const KW_BONUS = 0.2; // added per option keyword found in the spoken text

const normalize = (text = '') =>
  String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // strip punctuation (unicode-aware)
    .replace(/\s+/g, ' ')
    .trim();

const tokenSet = (text = '') => {
  const set = new Set();
  for (const w of normalize(text).split(' ')) {
    if (w && !STOP_WORDS.has(w)) set.add(w);
  }
  return set;
};

// Count shared tokens between two sets.
function intersectionCount(a, b) {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter;
}

// "option a", "letter b", "number 2", "choice c", or a bare "a"/"b"/"c"/"d".
const LETTER = { a: 0, b: 1, c: 2, d: 3 };
function commandIndex(spoken, optionCount) {
  const n = normalize(spoken);
  let m = n.match(/\b(?:option|letter|choice|number|pick|select)\s+([a-d]|[1-9])\b/);
  if (!m) m = n.match(/^([a-d])$/); // a bare single letter
  if (!m) return -1;
  const token = m[1];
  const idx = token in LETTER ? LETTER[token] : parseInt(token, 10) - 1;
  return idx >= 0 && idx < optionCount ? idx : -1;
}

/**
 * @param {string} spoken  the recognised speech
 * @param {Array<{index:number,text:string,keywords?:string[]}>} options
 * @returns {{ best: {index,score,text}|null, candidates: Array, confident: boolean, viaCommand: boolean }}
 */
export function matchResponse(spoken = '', options = []) {
  if (!options.length) return { best: null, candidates: [], confident: false, viaCommand: false };

  // 1) Direct voice command wins immediately.
  const cmd = commandIndex(spoken, options.length);
  if (cmd !== -1) {
    const opt = options[cmd];
    return { best: { index: opt.index ?? cmd, score: 1, text: opt.text }, candidates: [], confident: true, viaCommand: true };
  }

  // 2) Score each option: overlap coefficient (relative to the smaller set, so a
  //    short paraphrase that hits an option's distinctive words scores high) + keywords.
  const spokenSet = tokenSet(spoken);
  const spokenNorm = normalize(spoken);
  const scored = options.map((opt, i) => {
    const optSet = tokenSet(opt.text);
    const inter = intersectionCount(spokenSet, optSet);
    const denom = Math.max(1, Math.min(spokenSet.size, optSet.size));
    let score = inter / denom;
    let kw = 0;
    for (const k of opt.keywords || []) {
      const key = normalize(k);
      if (key && spokenNorm.includes(key)) { score += KW_BONUS; kw += 1; }
    }
    return { index: opt.index ?? i, text: opt.text, score: Math.min(1, Number(score.toFixed(4))), inter, kw };
  });

  scored.sort((a, b) => b.score - a.score);
  const [best, runnerUp] = scored;
  // Auto-select only on a clear, grounded win (not a single common-word fluke).
  const confident =
    !!best &&
    best.score >= AUTO_THRESHOLD &&
    best.score - (runnerUp?.score || 0) >= LEAD_MARGIN &&
    (best.inter >= 2 || best.kw >= 1);

  return {
    best: best && best.score > 0 ? { index: best.index, score: best.score, text: best.text } : null,
    candidates: scored.filter((s) => s.score > 0).slice(0, 3).map((s) => ({ index: s.index, text: s.text, score: s.score })),
    confident,
    viaCommand: false,
  };
}

export default matchResponse;
