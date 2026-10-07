const crypto = require('crypto');
const Lesson = require('../models/Lesson');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Progress = require('../models/Progress');
const Certificate = require('../models/Certificate');

const idStr = (id) => String(id);

/**
 * Computes progress for many agents x many courses with only 4 queries.
 * Returns: matrix[userId][courseId] = {
 *   percent, status, completedLessons, totalLessons, passedQuizzes, totalQuizzes, averageBestScore, quizzes: {quizId: {best, passed, attempts}}
 * }
 * Progress % = (lessons done + quizzes passed) / (total lessons + total quizzes)
 */
async function buildProgressMatrix(userIds, courseIds) {
  const [lessons, quizzes, progressDocs, attempts] = await Promise.all([
    Lesson.find({ course: { $in: courseIds } }).select('course'),
    Quiz.find({ course: { $in: courseIds } }).select('course'),
    Progress.find({ user: { $in: userIds }, course: { $in: courseIds } }),
    QuizAttempt.find({ user: { $in: userIds }, course: { $in: courseIds } }).select('user quiz percentage passed'),
  ]);

  // course -> lesson ids / quiz ids
  const lessonsByCourse = {};
  const quizzesByCourse = {};
  courseIds.forEach((c) => {
    lessonsByCourse[idStr(c)] = new Set();
    quizzesByCourse[idStr(c)] = [];
  });
  lessons.forEach((l) => lessonsByCourse[idStr(l.course)]?.add(idStr(l._id)));
  quizzes.forEach((q) => quizzesByCourse[idStr(q.course)]?.push(idStr(q._id)));

  // user|course -> progress doc
  const progressMap = {};
  progressDocs.forEach((p) => (progressMap[`${p.user}|${p.course}`] = p));

  // user|quiz -> { best, passed, attempts }
  const quizStats = {};
  attempts.forEach((a) => {
    const key = `${a.user}|${a.quiz}`;
    const s = quizStats[key] || { best: 0, passed: false, attempts: 0 };
    s.best = Math.max(s.best, a.percentage);
    s.passed = s.passed || a.passed;
    s.attempts += 1;
    quizStats[key] = s;
  });

  const matrix = {};
  userIds.forEach((u) => {
    const uid = idStr(u);
    matrix[uid] = {};
    courseIds.forEach((c) => {
      const cid = idStr(c);
      const lessonSet = lessonsByCourse[cid];
      const quizIds = quizzesByCourse[cid];
      const progress = progressMap[`${uid}|${cid}`];

      const completedLessons = progress
        ? progress.completedLessons.filter((l) => lessonSet.has(idStr(l))).length
        : 0;

      const quizzesInfo = {};
      let passedQuizzes = 0;
      let bestSum = 0;
      let attemptedQuizzes = 0;
      quizIds.forEach((qid) => {
        const s = quizStats[`${uid}|${qid}`] || { best: 0, passed: false, attempts: 0 };
        quizzesInfo[qid] = s;
        if (s.passed) passedQuizzes += 1;
        if (s.attempts > 0) {
          attemptedQuizzes += 1;
          bestSum += s.best;
        }
      });

      const totalItems = lessonSet.size + quizIds.length;
      const doneItems = completedLessons + passedQuizzes;
      const percent = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;

      let status = 'not_started';
      if (totalItems && doneItems === totalItems) status = 'completed';
      else if (progress || attemptedQuizzes > 0) status = 'in_progress';

      matrix[uid][cid] = {
        percent,
        status,
        completedLessons,
        totalLessons: lessonSet.size,
        passedQuizzes,
        totalQuizzes: quizIds.length,
        averageBestScore: attemptedQuizzes ? Math.round(bestSum / attemptedQuizzes) : null,
        completedLessonIds: progress ? progress.completedLessons.map(idStr) : [],
        quizzes: quizzesInfo,
      };
    });
  });

  return matrix;
}

const generateCertificateCode = () =>
  `VLA-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`;

/**
 * Called after a lesson is completed or a quiz is passed.
 * Marks the course completed and issues a certificate when everything is done.
 */
async function syncCourseCompletion(userId, courseId) {
  const matrix = await buildProgressMatrix([userId], [courseId]);
  const stats = matrix[idStr(userId)][idStr(courseId)];

  const progress = await Progress.findOneAndUpdate(
    { user: userId, course: courseId },
    { $setOnInsert: { user: userId, course: courseId }, $set: { lastAccessedAt: new Date() } },
    { upsert: true, returnDocument: 'after' }
  );

  let certificate = null;
  if (stats.status === 'completed') {
    if (progress.status !== 'completed') {
      progress.status = 'completed';
      progress.completedAt = new Date();
      await progress.save();
    }
    certificate = await Certificate.findOne({ user: userId, course: courseId });
    if (!certificate) {
      certificate = await Certificate.create({
        user: userId,
        course: courseId,
        code: generateCertificateCode(),
        finalScore: stats.averageBestScore ?? 100,
      });
    }
  }

  return { ...stats, certificate };
}

module.exports = { buildProgressMatrix, syncCourseCompletion };
