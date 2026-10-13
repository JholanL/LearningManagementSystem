// AI semantic fallback for the Call Simulator: when the offline matcher can't tell
// which option the agent meant (same idea, different words/synonyms), ask Gemini.
// Returns { index, quality } (quality 0..1) or null. NEVER throws — on any error or
// when AI is not configured, it returns null so the caller falls back to "try again".
const { callGemini, isConfigured } = require('../utils/gemini');

async function semanticMatch(text, options) {
  if (!isConfigured() || !text || !Array.isArray(options) || !options.length) return null;

  const list = options.map((o, i) => `${i}) ${o.text}`).join('\n');
  const prompt =
    `A call-center agent replied to a customer. Here are the possible intended responses:\n${list}\n\n` +
    `The agent actually said: "${String(text).slice(0, 500)}"\n\n` +
    `Which numbered response does the agent's answer express the SAME meaning as — even with different ` +
    `words, synonyms or phrasing? Return "index" (the number, or -1 if it matches none) and "match" = 0-100 ` +
    `for how completely the agent's answer conveys that response's intent and content.`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: { index: { type: 'INTEGER' }, match: { type: 'INTEGER' } },
        required: ['index', 'match'],
      },
      temperature: 0,
    },
  };

  try {
    const data = await callGemini(body, { retries: 2 });
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const out = JSON.parse(raw);
    const index = Number(out.index);
    if (!Number.isInteger(index) || index < 0 || index >= options.length) return null;
    const quality = Math.max(0, Math.min(1, (Number.isFinite(Number(out.match)) ? Number(out.match) : 0) / 100));
    return quality > 0 ? { index, quality } : null;
  } catch {
    return null;
  }
}

module.exports = { semanticMatch };
