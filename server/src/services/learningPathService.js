// Sequential learning path: Lesson 1 → its quiz(zes) → Lesson 2 → its quiz(zes)
// → … → course-level ("final") quizzes at the end.
// A step unlocks only when every earlier step is done (lesson completed / quiz passed).
// Used to gate lesson + quiz access (so it can't be skipped via the URL) and to
// tell the agent where to go next.
const Lesson = require('../models/Lesson');
const Quiz = require('../models/Quiz');
const Progress = require('../models/Progress');
const QuizAttempt = require('../models/QuizAttempt');
const ApiError = require('../utils/ApiError');

async function pathState(userId, courseId) {
  const [lessons, quizzes, progress, passed] = await Promise.all([
    Lesson.find({ course: courseId }).select('_id order').sort('order'),
    Quiz.find({ course: courseId }).select('_id lesson createdAt').sort('createdAt'),
    Progress.findOne({ user: userId, course: courseId }).select('completedLessons'),
    QuizAttempt.find({ user: userId, course: courseId, passed: true }).select('quiz'),
  ]);
  const doneLessons = new Set((progress?.completedLessons || []).map(String));
  const passedQuizzes = new Set(passed.map((a) => String(a.quiz)));
  return { lessons, quizzes, doneLessons, passedQuizzes };
}

// Every lesson with a smaller order is completed AND its quizzes are passed.
function earlierDone(order, { lessons, quizzes, doneLessons, passedQuizzes }) {
  const earlierIds = lessons.filter((l) => l.order < order).map((l) => String(l._id));
  if (!earlierIds.every((id) => doneLessons.has(id))) return false;
  const earlierSet = new Set(earlierIds);
  return quizzes
    .filter((q) => q.lesson && earlierSet.has(String(q.lesson)))
    .every((q) => passedQuizzes.has(String(q._id)));
}

// Build the ordered list of steps: [{type:'lesson'|'quiz', id}]
function buildSteps({ lessons, quizzes }) {
  const byLesson = {};
  quizzes.forEach((q) => {
    const key = q.lesson ? String(q.lesson) : '__final__';
    (byLesson[key] = byLesson[key] || []).push(q);
  });
  const steps = [];
  lessons.forEach((l) => {
    steps.push({ type: 'lesson', id: String(l._id) });
    (byLesson[String(l._id)] || []).forEach((q) => steps.push({ type: 'quiz', id: String(q._id) }));
  });
  (byLesson.__final__ || []).forEach((q) => steps.push({ type: 'quiz', id: String(q._id) }));
  return steps;
}

async function assertLessonUnlocked(userId, course, lesson, { forComplete = false } = {}) {
  const state = await pathState(userId, course._id);
  if (!earlierDone(lesson.order, state)) {
    throw new ApiError(
      403,
      forComplete ? 'Finish the previous lesson and its quiz first.' : 'Finish the previous lesson and its quiz to unlock this one.'
    );
  }
}

async function assertQuizUnlocked(userId, course, quiz) {
  const state = await pathState(userId, course._id);
  if (quiz.lesson) {
    if (!state.doneLessons.has(String(quiz.lesson))) {
      throw new ApiError(403, 'Complete the lesson before taking its quiz.');
    }
    const lesson = state.lessons.find((l) => String(l._id) === String(quiz.lesson));
    if (lesson && !earlierDone(lesson.order, state)) {
      throw new ApiError(403, 'Finish the previous lessons and quizzes first.');
    }
  } else {
    const allLessonsDone = state.lessons.every((l) => state.doneLessons.has(String(l._id)));
    const allLessonQuizzesPassed = state.quizzes
      .filter((q) => q.lesson)
      .every((q) => state.passedQuizzes.has(String(q._id)));
    if (!allLessonsDone || !allLessonQuizzesPassed) {
      throw new ApiError(403, 'Finish all lessons and their quizzes before the final quiz.');
    }
  }
}

// The next step the agent should do (first not-done), or { type:'course' } when finished.
async function nextStep(userId, courseId) {
  const state = await pathState(userId, courseId);
  for (const s of buildSteps(state)) {
    const done = s.type === 'lesson' ? state.doneLessons.has(s.id) : state.passedQuizzes.has(s.id);
    if (!done) return s;
  }
  return { type: 'course', id: String(courseId) };
}

module.exports = { pathState, assertLessonUnlocked, assertQuizUnlocked, nextStep };
