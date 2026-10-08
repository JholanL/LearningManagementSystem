// Client-side MIRROR of the server's delivery rules (server/src/utils/deliveryMetrics.js).
// Used ONLY for live hints while the agent is on a call. The server always
// recomputes the real, stored score — never trust these numbers for grading.

export const FILLERS = [
  'um', 'uh', 'uhm', 'erm', 'ah', 'like', 'you know', 'basically', 'actually',
  'i mean', 'kind of', 'sort of', 'ano', 'parang', 'ganun', 'bale',
];

export const DEAD_AIR_MS = 3000; // amber threshold
export const DEAD_AIR_RED_MS = 5000; // red threshold for the live timer
export const WPM_MIN = 120;
export const WPM_MAX = 170;

const clamp = (n, lo, hi) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return lo;
  return Math.min(Math.max(num, lo), hi);
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const countWords = (text = '') => {
  const m = String(text).trim().match(/\S+/g);
  return m ? m.length : 0;
};

export function countFillers(text = '') {
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

// Live timer colour for the dead-air indicator: 'ok' | 'amber' | 'red'.
export const deadAirLevel = (silenceMs) => {
  if (silenceMs >= DEAD_AIR_RED_MS) return 'red';
  if (silenceMs >= DEAD_AIR_MS) return 'amber';
  return 'ok';
};

// Same scoring maths as the server, for an at-a-glance live estimate.
export function computeDelivery({ agentTexts = [], timing = [] } = {}) {
  const joined = agentTexts.join(' ');
  const { fillerCount, fillers } = countFillers(joined);
  const totalWords = agentTexts.reduce((sum, t) => sum + countWords(t), 0);

  const silences = (timing || []).map((t) => clamp(t && t.silenceBeforeMs, 0, 120000));
  const durations = (timing || []).map((t) => clamp(t && t.durationMs, 0, 600000));

  const longestSilenceMs = silences.length ? Math.max(...silences) : 0;
  const deadAirIncidents = silences.filter((s) => s > DEAD_AIR_MS);
  const deadAirCount = deadAirIncidents.length;
  const deadAirMs = deadAirIncidents.reduce((sum, s) => sum + s, 0);
  const talkTimeMs = durations.reduce((sum, d) => sum + d, 0);
  const totalDurationMs = talkTimeMs + silences.reduce((sum, s) => sum + s, 0);

  const wordsPerMinute = talkTimeMs > 0 ? Math.round(totalWords / (talkTimeMs / 60000)) : 0;
  const wpmOff = talkTimeMs > 0 && (wordsPerMinute < WPM_MIN || wordsPerMinute > WPM_MAX);

  let score = 100;
  score -= 5 * deadAirCount;
  score -= Math.min(30, 2 * Math.max(0, fillerCount - 2));
  if (wpmOff) score -= 10;
  const deliveryScore = clamp(Math.round(score), 0, 100);

  return { deadAirMs, longestSilenceMs, deadAirCount, fillerCount, fillers, wordsPerMinute, talkTimeMs, totalDurationMs, deliveryScore };
}
