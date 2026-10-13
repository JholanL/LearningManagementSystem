const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { callGemini } = require('../utils/gemini');

const MAX_INPUT_CHARS = 15000;

// POST /api/ai/generate-quiz  { text, count }  (trainer, admin)
// Generates multiple-choice questions from lesson text via Google Gemini.
// The API key stays on the server; the response is sanitised into our quiz shape.
exports.generateQuiz = asyncHandler(async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ApiError(503, 'AI quiz generation is not configured. Add GEMINI_API_KEY to the server .env.');

  const text = String(req.body.text || '').slice(0, MAX_INPUT_CHARS).trim();
  if (text.length < 50) throw new ApiError(400, 'Provide more lesson text (a few sentences at least) to generate a quiz.');
  const count = Math.min(Math.max(parseInt(req.body.count, 10) || 5, 1), 10);

  const prompt =
    `You are a call-center training content writer. From the LESSON TEXT below, create a short quiz. ` +
    `Also propose: a concise quiz "title" (max ~8 words), a one-sentence "description", and a sensible ` +
    `"timeLimitMinutes" (a whole number; 0 means no limit). Then write ${count} multiple-choice questions ` +
    `that test real understanding — each with exactly 4 options, exactly one correct answer, and a short ` +
    `explanation. Keep everything specific to the text and unambiguous.\n\nLESSON TEXT:\n${text}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          timeLimitMinutes: { type: 'INTEGER' },
          questions: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                question: { type: 'STRING' },
                options: { type: 'ARRAY', items: { type: 'STRING' } },
                correctAnswer: { type: 'INTEGER' },
                explanation: { type: 'STRING' },
              },
              required: ['question', 'options', 'correctAnswer'],
            },
          },
        },
        required: ['title', 'questions'],
      },
    },
  };

  const data = await callGemini(body);

  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError(502, 'The AI returned an unexpected format. Please try again.');
  }
  const out = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};

  // Sanitise into our quiz shape (trainer reviews/edits before saving).
  const questions = (Array.isArray(out.questions) ? out.questions : [])
    .slice(0, count)
    .map((q) => {
      const options = (Array.isArray(q.options) ? q.options : []).map((o) => String(o).trim()).filter(Boolean).slice(0, 6);
      let correct = Number.isInteger(q.correctAnswer) ? q.correctAnswer : 0;
      if (correct < 0 || correct >= options.length) correct = 0;
      return {
        question: String(q.question || '').trim(),
        options,
        correctAnswer: correct,
        explanation: String(q.explanation || '').trim(),
        points: 1,
      };
    })
    .filter((q) => q.question && q.options.length >= 2);

  if (!questions.length) throw new ApiError(502, 'The AI could not produce usable questions from this text.');

  let timeLimitMinutes = Number.isInteger(out.timeLimitMinutes) ? out.timeLimitMinutes : 0;
  timeLimitMinutes = Math.min(Math.max(timeLimitMinutes, 0), 180);

  res.json({
    success: true,
    data: {
      title: String(out.title || '').trim().slice(0, 150),
      description: String(out.description || '').trim().slice(0, 1000),
      timeLimitMinutes,
      questions,
    },
  });
});

// POST /api/ai/format-lesson  { text }  (trainer, admin)
// Reformats raw (e.g. PDF-extracted) lesson text into clean, readable Markdown:
// `##` section headings, bullet lists, short paragraphs. No facts are added.
exports.formatLesson = asyncHandler(async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ApiError(503, 'AI formatting is not configured. Add GEMINI_API_KEY to the server .env.');

  const text = String(req.body.text || '').slice(0, MAX_INPUT_CHARS).trim();
  if (text.length < 50) throw new ApiError(400, 'Provide more lesson text to format.');

  const prompt =
    `You are a call-center training content editor. Reformat the LESSON TEXT below into clean, well-structured ` +
    `Markdown that is easy to read and study, WITHOUT changing or adding any facts.\n` +
    `Rules:\n` +
    `- Break it into 3-7 logical sections. Start each section with a "## " heading (short, descriptive).\n` +
    `- Use "- " bullet points for lists, steps or enumerations.\n` +
    `- Keep paragraphs short (2-4 sentences). Use **bold** for key terms sparingly.\n` +
    `- Do NOT include a top-level "# " title, code fences, or any commentary — output only the Markdown body.\n` +
    `- Preserve all the original information; only reorganise and format it.\n\nLESSON TEXT:\n${text}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'text/plain', temperature: 0.2 },
  };

  const data = await callGemini(body);

  let markdown = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  // Strip accidental code fences or a stray leading "# " title.
  markdown = markdown.replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```$/, '').trim();
  markdown = markdown.replace(/^#\s+.*\n+/, '').trim();
  if (!markdown) throw new ApiError(502, 'The AI could not format this text. Please try again.');

  res.json({ success: true, data: { markdown: markdown.slice(0, 20000) } });
});
