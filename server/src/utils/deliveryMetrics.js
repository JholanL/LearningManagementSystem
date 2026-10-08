// Pure delivery-metric computation for the voice call simulator (feature 1).
// The SERVER is the source of truth: it recomputes everything from the transcript
// text and the per-turn timing, and never trusts a client-sent score.
// Keep this file free of DB / Express imports so it can be unit tested.

// Filler words and phrases (English + common Taglish), matched case-insensitively.
const FILLERS = [
  'um', 'uh', 'uhm', 'erm', 'ah', 'like', 'you know', 'basically', 'actually',
  'i mean', 'kind of', 'sort of', 'ano', 'parang', 'ganun', 'bale',
];

const DEAD_AIR_MS = 3000; // silence longer than this before an agent turn = one incident
const WPM_MIN = 120;
const WPM_MAX = 170;
const MAX_SILENCE_MS = 120000; // clamp absurd client values (2 minutes)
const MAX_DURATION_MS = 600000; // 10 minutes per turn

const clamp = (n, lo, hi) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return lo;
  return Math.min(Math.max(num, lo), hi);
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const countWords = (text = '') => {
  const m = String(text).trim().match(/\S+/g);
  return m ? m.length : 0;
};

// Count each filler as a whole word / phrase. Returns { fillerCount, fillers: {word: n} }.
function countFillers(text = '') {
  const haystack = ` ${String(text).toLowerCase()} `;
  const fillers = {};
  let fillerCount = 0;
  for (const f of FILLERS) {
    const re = new RegExp(`\\b${escapeRegex(f)}\\b`, 'g');
    const matches = haystack.match(re);
    if (matches && matches.length) {
      fillers[f] = matches.length;
      fillerCount += matches.length;
    }
  }
  return { fillerCount, fillers };
}

function buildTips({ deadAirCount, fillerCount, fillers, wordsPerMinute, wpmOff }) {
  const tips = [];
  if (deadAirCount > 0) {
    tips.push(
      `${deadAirCount} dead-air moment${deadAirCount > 1 ? 's' : ''} over 3s. Use a hold script: "May I place you on a brief hold while I check?"`
    );
  }
  if (fillerCount > 2) {
    const top = Object.entries(fillers).sort((a, b) => b[1] - a[1])[0];
    tips.push(`${fillerCount} filler words${top ? ` (most used: "${top[0]}")` : ''}. Pause silently instead of using fillers.`);
  }
  if (wpmOff) {
    tips.push(
      wordsPerMinute < WPM_MIN
        ? `You spoke at ${wordsPerMinute} WPM — a little slow. Aim for 120–170 WPM.`
        : `You spoke at ${wordsPerMinute} WPM — a little fast. Slow to 120–170 WPM so customers can follow.`
    );
  }
  if (!tips.length) tips.push('Great delivery — steady pace, minimal fillers, and no dead air.');
  return tips;
}

/**
 * Compute delivery metrics for a voice attempt.
 * @param {Object} input
 * @param {string[]} input.agentTexts  what the agent said, one string per agent turn
 * @param {Array<{silenceBeforeMs:number,durationMs:number}>} input.timing  one entry per agent turn
 * @returns {{ deadAirMs, longestSilenceMs, deadAirCount, fillerCount, fillers, wordsPerMinute, talkTimeMs, totalDurationMs, deliveryScore, tips }}
 */
function computeDelivery({ agentTexts = [], timing = [] } = {}) {
  const joined = agentTexts.join(' ');
  const { fillerCount, fillers } = countFillers(joined);
  const totalWords = agentTexts.reduce((sum, t) => sum + countWords(t), 0);

  const silences = (timing || []).map((t) => clamp(t && t.silenceBeforeMs, 0, MAX_SILENCE_MS));
  const durations = (timing || []).map((t) => clamp(t && t.durationMs, 0, MAX_DURATION_MS));

  const longestSilenceMs = silences.length ? Math.max(...silences) : 0;
  const deadAirIncidents = silences.filter((s) => s > DEAD_AIR_MS);
  const deadAirCount = deadAirIncidents.length;
  const deadAirMs = deadAirIncidents.reduce((sum, s) => sum + s, 0);
  const talkTimeMs = durations.reduce((sum, d) => sum + d, 0);
  const totalDurationMs = talkTimeMs + silences.reduce((sum, s) => sum + s, 0);

  const wordsPerMinute = talkTimeMs > 0 ? Math.round(totalWords / (talkTimeMs / 60000)) : 0;
  const wpmOff = talkTimeMs > 0 && (wordsPerMinute < WPM_MIN || wordsPerMinute > WPM_MAX);

  // Score: start at 100, subtract penalties, clamp to 0-100.
  let score = 100;
  score -= 5 * deadAirCount; // 5 per dead-air incident
  score -= Math.min(30, 2 * Math.max(0, fillerCount - 2)); // 2 per filler beyond the first 2, max 30
  if (wpmOff) score -= 10; // outside the target band
  const deliveryScore = clamp(Math.round(score), 0, 100);

  return {
    deadAirMs,
    longestSilenceMs,
    deadAirCount,
    fillerCount,
    fillers,
    wordsPerMinute,
    talkTimeMs,
    totalDurationMs,
    deliveryScore,
    tips: buildTips({ deadAirCount, fillerCount, fillers, wordsPerMinute, wpmOff }),
  };
}

module.exports = { computeDelivery, countFillers, countWords, FILLERS, DEAD_AIR_MS, WPM_MIN, WPM_MAX };
