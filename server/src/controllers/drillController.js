const DrillSession = require('../models/DrillSession');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { paginate } = require('../utils/query');
const { manilaToday, addDays } = require('../utils/manilaDate');
const { getAgentCourseIds } = require('../services/accessService');
const { buildProgressMatrix } = require('../services/progressService');
const { notify } = require('../services/notificationService');

const DRILL_SIZE = 5;
const MILESTONES = [3, 7, 14];

// --- Deterministic RNG seeded by a string (xmur3 + mulberry32) ---
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, seedStr) {
  const rng = mulberry32(xmur3(seedStr)());
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const key = (quizId, questionId) => `${quizId}|${questionId}`;

// Pick up to 5 (quizId, questionId) refs by priority: wrong answers first,
// then not-completed courses, then completed courses. Deterministic per user+date.
async function selectQuestions(user, date) {
  const courseIds = await getAgentCourseIds(user);
  if (!courseIds.length) return [];

  const quizzes = await Quiz.find({ course: { $in: courseIds } }).select('course questions');
  if (!quizzes.length) return [];

  // pool of valid question refs + which course each quiz belongs to
  const pool = new Map(); // key -> { quizId, questionId }
  const courseOfQuiz = {};
  quizzes.forEach((q) => {
    courseOfQuiz[String(q._id)] = String(q.course);
    q.questions.forEach((qq) => pool.set(key(q._id, qq._id), { quizId: q._id, questionId: qq._id }));
  });

  // classify courses as completed vs not (for tiers 2 & 3)
  const matrix = await buildProgressMatrix([user._id], courseIds);
  const mine = matrix[String(user._id)] || {};
  const completedCourses = new Set(Object.entries(mine).filter(([, v]) => v.status === 'completed').map(([cid]) => cid));

  const seen = new Set();
  const take = (ref) => {
    const k = key(ref.quizId, ref.questionId);
    if (!seen.has(k)) {
      seen.add(k);
      return true;
    }
    return false;
  };

  // Tier 1: questions answered WRONG before, most recent first.
  const tier1 = [];
  const attempts = await QuizAttempt.find({ user: user._id, course: { $in: courseIds } }).sort('-createdAt').select('quiz answerDetails');
  attempts.forEach((a) => {
    (a.answerDetails || []).forEach((d) => {
      if (d.correct === false) {
        const ref = pool.get(key(a.quiz, d.questionId));
        if (ref && take(ref)) tier1.push(ref);
      }
    });
  });

  // Tiers 2 & 3: remaining pool split by course completion.
  const tier2 = [];
  const tier3 = [];
  pool.forEach((ref, k) => {
    if (seen.has(k)) return;
    seen.add(k);
    const completed = completedCourses.has(courseOfQuiz[String(ref.quizId)]);
    (completed ? tier3 : tier2).push(ref);
  });

  const seed = `${user._id}:${date}`;
  const ordered = [...tier1, ...seededShuffle(tier2, `${seed}:2`), ...seededShuffle(tier3, `${seed}:3`)];
  return ordered.slice(0, DRILL_SIZE);
}

// Consecutive completed days ending today or yesterday.
async function computeStreak(userId, today) {
  const sessions = await DrillSession.find({ user: userId, completedAt: { $ne: null } }).select('date');
  const done = new Set(sessions.map((s) => s.date));
  let cursor = today;
  if (!done.has(cursor)) {
    const y = addDays(today, -1);
    if (!done.has(y)) return 0;
    cursor = y;
  }
  let streak = 0;
  while (done.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// Attach question text/options to refs (NEVER the correct answer).
async function hydrate(refs) {
  if (!refs.length) return [];
  const quizIds = [...new Set(refs.map((r) => String(r.quizId)))];
  const quizzes = await Quiz.find({ _id: { $in: quizIds } }).select('title questions');
  const byId = {};
  quizzes.forEach((q) => byId[String(q._id)] = q);
  return refs
    .map((r) => {
      const quiz = byId[String(r.quizId)];
      const q = quiz?.questions.id(r.questionId);
      if (!q) return null;
      return { quizId: r.quizId, questionId: r.questionId, quizTitle: quiz.title, question: q.question, options: q.options };
    })
    .filter(Boolean);
}

// Build the review (with correct answers + explanations) from a completed session.
async function buildReview(session) {
  const quizIds = [...new Set(session.questions.map((r) => String(r.quizId)))];
  const quizzes = await Quiz.find({ _id: { $in: quizIds } }).select('title questions');
  const byId = {};
  quizzes.forEach((q) => byId[String(q._id)] = q);
  return session.questions.map((r, i) => {
    const quiz = byId[String(r.quizId)];
    const q = quiz?.questions.id(r.questionId);
    const selected = session.answers[i];
    return {
      quizTitle: quiz?.title,
      question: q?.question,
      options: q?.options || [],
      selected,
      correctAnswer: q?.correctAnswer,
      explanation: q?.explanation,
      correct: selected === q?.correctAnswer,
    };
  });
}

// GET /api/drill/today
exports.getToday = asyncHandler(async (req, res) => {
  const date = manilaToday();
  let session = await DrillSession.findOne({ user: req.user._id, date });

  if (!session) {
    const refs = await selectQuestions(req.user, date);
    if (!refs.length) {
      // No assigned courses / no questions → friendly empty state (don't persist).
      return res.json({ success: true, data: { date, completed: false, empty: true, questions: [], total: 0, streak: await computeStreak(req.user._id, date) } });
    }
    session = await DrillSession.create({ user: req.user._id, date, questions: refs });
  }

  const streak = await computeStreak(req.user._id, date);
  const completed = !!session.completedAt;
  res.json({
    success: true,
    data: {
      date,
      completed,
      total: session.questions.length,
      questions: await hydrate(session.questions),
      streak,
      ...(completed && { score: session.score, review: await buildReview(session) }),
    },
  });
});

// POST /api/drill/submit   { answers: [optionIndex] }
exports.submit = asyncHandler(async (req, res) => {
  const date = manilaToday();
  let session = await DrillSession.findOne({ user: req.user._id, date });
  if (!session) {
    const refs = await selectQuestions(req.user, date);
    if (!refs.length) throw new ApiError(400, 'No drill is available today. Ask your trainer to assign courses.');
    session = await DrillSession.create({ user: req.user._id, date, questions: refs });
  }
  if (session.completedAt) throw new ApiError(409, 'You already completed today\'s drill.');
  if (!session.questions.length) throw new ApiError(400, 'No drill is available today.');

  const answers = session.questions.map((_, i) => {
    const a = req.body.answers?.[i];
    return Number.isInteger(a) ? a : -1;
  });

  session.answers = answers;
  session.completedAt = new Date();
  const review = await buildReview(session); // uses session.answers
  session.score = review.filter((r) => r.correct).length;
  session.total = session.questions.length;
  await session.save();

  const streak = await computeStreak(req.user._id, date);
  if (MILESTONES.includes(streak)) {
    await notify(req.user._id, {
      type: 'drill.streak',
      title: `${streak}-day drill streak! 🔥`,
      message: `You've practiced ${streak} days in a row. Keep it going!`,
      link: '/agent/drill',
    });
  }

  res.status(201).json({ success: true, message: 'Drill complete!', data: { date, score: session.score, total: session.total, review, streak } });
});

// GET /api/drill/history?page=&limit=
exports.history = asyncHandler(async (req, res) => {
  const result = await paginate(DrillSession, { user: req.user._id, completedAt: { $ne: null } }, req.query, {
    sort: '-date',
    select: 'date score total completedAt',
  });
  res.json({ success: true, ...result });
});
