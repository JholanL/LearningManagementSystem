const Quiz = require('../models/Quiz');
const Course = require('../models/Course');
const QuizAttempt = require('../models/QuizAttempt');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');
const { paginate } = require('../utils/query');
const { assertCanViewCourse, assertCanEditCourse } = require('../services/accessService');
const { syncCourseCompletion } = require('../services/progressService');

const FIELDS = ['title', 'description', 'timeLimitMinutes', 'questions'];

async function loadQuiz(id) {
  const quiz = await Quiz.findById(id);
  if (!quiz) throw new ApiError(404, 'Quiz not found');
  const course = await Course.findById(quiz.course);
  if (!course) throw new ApiError(404, 'Course not found');
  return { quiz, course };
}

// GET /api/courses/:courseId/quizzes
exports.getQuizzes = asyncHandler(async (req, res) => {
  await assertCanViewCourse(req.user, req.params.courseId);
  const quizzes = await Quiz.find({ course: req.params.courseId }).sort('createdAt');
  const data = quizzes.map((q) => ({
    _id: q._id,
    title: q.title,
    description: q.description,
    timeLimitMinutes: q.timeLimitMinutes,
    questionCount: q.questions.length,
    totalPoints: q.totalPoints,
  }));
  res.json({ success: true, data });
});

// POST /api/courses/:courseId/quizzes   (owner trainer, admin)
exports.createQuiz = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) throw new ApiError(404, 'Course not found');
  assertCanEditCourse(req.user, course);
  const quiz = await Quiz.create({ ...pick(req.body, FIELDS), course: course._id });
  res.status(201).json({ success: true, message: 'Quiz created.', data: quiz });
});

// GET /api/quizzes/:id
// Trainer/Admin get the full quiz (with answers). Agents get questions WITHOUT answers + their attempt info.
exports.getQuiz = asyncHandler(async (req, res) => {
  const { quiz, course } = await loadQuiz(req.params.id);
  await assertCanViewCourse(req.user, course);

  if (req.user.role !== 'agent') {
    return res.json({ success: true, data: { ...quiz.toObject({ virtuals: true }), courseTitle: course.title } });
  }

  const attempts = await QuizAttempt.find({ user: req.user._id, quiz: quiz._id }).select('percentage passed');
  res.json({
    success: true,
    data: {
      ...quiz.toAgentView(),
      courseTitle: course.title,
      passingScore: course.passingScore,
      maxAttempts: course.maxAttempts,
      attemptsUsed: attempts.length,
      attemptsLeft: Math.max(course.maxAttempts - attempts.length, 0),
      bestScore: attempts.length ? Math.max(...attempts.map((a) => a.percentage)) : null,
      passed: attempts.some((a) => a.passed),
    },
  });
});

// PUT /api/quizzes/:id   (owner trainer, admin)
exports.updateQuiz = asyncHandler(async (req, res) => {
  const { quiz, course } = await loadQuiz(req.params.id);
  assertCanEditCourse(req.user, course);
  Object.assign(quiz, pick(req.body, FIELDS));
  await quiz.save();
  res.json({ success: true, message: 'Quiz updated.', data: quiz });
});

// DELETE /api/quizzes/:id   (owner trainer, admin)
exports.deleteQuiz = asyncHandler(async (req, res) => {
  const { quiz, course } = await loadQuiz(req.params.id);
  assertCanEditCourse(req.user, course);
  await QuizAttempt.deleteMany({ quiz: quiz._id });
  await quiz.deleteOne();
  res.json({ success: true, message: 'Quiz deleted.' });
});

// POST /api/quizzes/:id/submit   (agent)
// Grading happens on the SERVER so agents can't fake their score.
// Correct answers are only revealed after passing or using all attempts.
exports.submitQuiz = asyncHandler(async (req, res) => {
  const { quiz, course } = await loadQuiz(req.params.id);
  await assertCanViewCourse(req.user, course);

  const previous = await QuizAttempt.find({ user: req.user._id, quiz: quiz._id }).select('passed');
  if (previous.some((a) => a.passed)) throw new ApiError(400, 'You already passed this quiz.');
  if (previous.length >= course.maxAttempts) {
    throw new ApiError(403, 'No attempts left for this quiz. Please coordinate with your trainer.');
  }

  const answers = quiz.questions.map((_, i) => {
    const a = req.body.answers[i];
    return Number.isInteger(a) ? a : -1;
  });

  let score = 0;
  const results = quiz.questions.map((q, i) => {
    const isCorrect = answers[i] === q.correctAnswer;
    if (isCorrect) score += q.points;
    return { questionId: q._id, question: q.question, options: q.options, selected: answers[i], isCorrect, q };
  });

  const totalPoints = quiz.totalPoints;
  const percentage = Math.round((score / totalPoints) * 100);
  const passed = percentage >= course.passingScore;
  const attemptNumber = previous.length + 1;
  const attemptsLeft = course.maxAttempts - attemptNumber;

  const attempt = await QuizAttempt.create({
    user: req.user._id,
    quiz: quiz._id,
    course: course._id,
    answers,
    score,
    totalPoints,
    percentage,
    passed,
    attemptNumber,
    timeTakenSeconds: req.body.timeTakenSeconds || 0,
  });

  const revealAnswers = passed || attemptsLeft <= 0;
  const progress = passed ? await syncCourseCompletion(req.user._id, course._id) : null;

  res.status(201).json({
    success: true,
    message: passed ? 'Congratulations, you passed!' : `You did not reach the ${course.passingScore}% passing score.`,
    data: {
      attemptId: attempt._id,
      score,
      totalPoints,
      percentage,
      passed,
      passingScore: course.passingScore,
      attemptNumber,
      attemptsLeft: Math.max(attemptsLeft, 0),
      answersRevealed: revealAnswers,
      review: results.map(({ q, ...r }) => ({
        ...r,
        ...(revealAnswers && { correctAnswer: q.correctAnswer, explanation: q.explanation }),
      })),
      ...(progress && { courseProgress: { percent: progress.percent, status: progress.status }, certificate: progress.certificate }),
    },
  });
});

// GET /api/quizzes/:id/attempts?page=&limit=
// Agent: own attempts. Trainer/Admin: everyone's attempts for this quiz.
exports.getAttempts = asyncHandler(async (req, res) => {
  const { course } = await loadQuiz(req.params.id);
  await assertCanViewCourse(req.user, course);

  const filter = { quiz: req.params.id };
  if (req.user.role === 'agent') filter.user = req.user._id;

  const result = await paginate(QuizAttempt, filter, req.query, {
    populate: { path: 'user', select: 'firstName lastName employeeId' },
    select: '-answers',
  });
  res.json({ success: true, ...result });
});
