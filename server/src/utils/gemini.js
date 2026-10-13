/* eslint-disable no-console */
// Shared Google Gemini caller with retry + backoff for transient overloads (503/429).
// Used by AI quiz/lesson generation and by the Call Simulator's semantic match fallback.
const ApiError = require('./ApiError');

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const RETRYABLE = [429, 500, 503];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isConfigured = () => !!process.env.GEMINI_API_KEY;

// Returns the parsed JSON body, or throws ApiError with a friendly message.
async function callGemini(body, { retries = 3 } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ApiError(503, 'AI is not configured. Add GEMINI_API_KEY to the server .env.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  let lastStatus = 0;
  let lastDetail = '';

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let resp;
    try {
      resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      if (attempt < retries) { await sleep(800 * 2 ** attempt); continue; }
      throw new ApiError(502, 'Could not reach the AI service. Please try again.');
    }
    if (resp.ok) return resp.json();

    const errText = await resp.text();
    lastStatus = resp.status;
    try { lastDetail = JSON.parse(errText)?.error?.message || ''; } catch { lastDetail = errText.slice(0, 160); }
    console.error('[ai] Gemini error', resp.status, errText.slice(0, 300));
    if (RETRYABLE.includes(resp.status) && attempt < retries) { await sleep(800 * 2 ** attempt); continue; }
    throw new ApiError(502, `AI error (${resp.status})${lastDetail ? `: ${lastDetail}` : ''}`);
  }
  throw new ApiError(503, `The AI model is busy right now (${lastStatus || 'overloaded'}). Please try again in a moment.${lastDetail ? ` — ${lastDetail}` : ''}`);
}

module.exports = { callGemini, isConfigured, MODEL };
