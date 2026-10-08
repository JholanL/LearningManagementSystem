const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');
const ScenarioAttempt = require('../models/ScenarioAttempt');
const Evaluation = require('../models/Evaluation');
const Batch = require('../models/Batch');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const round = (n) => Math.round(n);
const mean = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);

// Trainer must own the course; admins can see everything.
function assertCourseAccess(user, course) {
  if (user.role === 'admin') return;
  if (String(course.createdBy) === String(user._id)) return;
  throw new ApiError(403, 'You can only view analytics for your own courses.');
}

// Agents (ids) to scope an analysis to: a specific batch, or every batch that includes the course.
async function audienceAgentIds({ batchId, courseId }) {
  if (batchId) {
    const agents = await User.find({ batch: batchId, role: 'agent' }).select('_id');
    return agents.map((a) => a._id);
  }
  const batches = await Batch.find({ courses: courseId }).select('_id');
  if (!batches.length) return null; // null = no restriction
  const agents = await User.find({ batch: { $in: batches.map((b) => b._id) }, role: 'agent' }).select('_id');
  return agents.map((a) => a._id);
}

// Per-attempt summary numbers shared by quiz and course analytics.
function summarizeAttempts(attempts) {
  const total = attempts.length;
  const agents = new Set(attempts.map((a) => String(a.user)));
  const agentsPassed = new Set(attempts.filter((a) => a.passed).map((a) => String(a.user)));
  const firsts = attempts.filter((a) => a.attemptNumber === 1);
  const firstsPassed = firsts.filter((a) => a.passed);

  // avg attempts to pass: for each agent who passed, the attemptNumber of their first passing attempt
  const passByAgent = {};
  attempts
    .filter((a) => a.passed)
    .forEach((a) => {
      const k = String(a.user);
      if (passByAgent[k] === undefined || a.attemptNumber < passByAgent[k]) passByAgent[k] = a.attemptNumber;
    });
  const attemptsToPass = Object.values(passByAgent);

  return {
    attempts: total,
    uniqueAgents: agents.size,
    avgScore: round(mean(attempts.map((a) => a.percentage))),
    passRate: agents.size ? round((100 * agentsPassed.size) / agents.size) : 0,
    firstAttemptPassRate: firsts.length ? round((100 * firstsPassed.length) / firsts.length) : 0,
    avgAttemptsToPass: attemptsToPass.length ? Number(mean(attemptsToPass).toFixed(1)) : null,
  };
}

const DISTRIBUTION_BUCKETS = [
  { label: '0-49', min: 0, max: 49 },
  { label: '50-69', min: 50, max: 69 },
  { label: '70-84', min: 70, max: 84 },
  { label: '85-100', min: 85, max: 100 },
];

// Selected option index for a question in one attempt (prefers answerDetails; falls back to answers[] by order).
function selectedFor(attempt, question, qIndex) {
  if (attempt.answerDetails && attempt.answerDetails.length) {
    const d = attempt.answerDetails.find((x) => String(x.questionId) === String(question._id));
    if (d) return d.selected;
  }
  return attempt.answers && attempt.answers.length > qIndex ? attempt.answers[qIndex] : -1;
}

// GET /api/analytics/quiz/:quizId?batch=
exports.quizAnalytics = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.quizId);
  if (!quiz) throw new ApiError(404, 'Quiz not found');
  const course = await Course.findById(quiz.course);
  if (!course) throw new ApiError(404, 'Course not found');
  assertCourseAccess(req.user, course);

  const filter = { quiz: quiz._id };
  if (req.query.batch) {
    const ids = await audienceAgentIds({ batchId: req.query.batch });
    filter.user = { $in: ids };
  }
  const attempts = await QuizAttempt.find(filter).select('user percentage passed attemptNumber answers answerDetails');

  const distribution = DISTRIBUTION_BUCKETS.map((b) => ({
    label: b.label,
    count: attempts.filter((a) => a.percentage >= b.min && a.percentage <= b.max).length,
  }));

  const questions = quiz.questions.map((q, qIndex) => {
    const selections = attempts.map((a) => selectedFor(a, q, qIndex)).filter((s) => Number.isInteger(s) && s >= 0);
    const answered = selections.length;
    const correct = selections.filter((s) => s === q.correctAnswer).length;
    const optionCounts = q.options.map((_, i) => selections.filter((s) => s === i).length);
    let topWrongOption = null;
    let topWrong = -1;
    optionCounts.forEach((count, i) => {
      if (i !== q.correctAnswer && count > topWrong) {
        topWrong = count;
        topWrongOption = i;
      }
    });
    if (topWrong <= 0) topWrongOption = null;
    const correctRate = answered ? round((100 * correct) / answered) : 0;
    return {
      questionId: q._id,
      text: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      attempts: answered,
      correctRate,
      optionCounts,
      topWrongOption,
      needsReview: answered > 0 && correctRate < 60,
    };
  });

  res.json({
    success: true,
    data: {
      quiz: { _id: quiz._id, title: quiz.title, course: course._id, courseCode: course.code, courseTitle: course.title, passingScore: course.passingScore },
      summary: summarizeAttempts(attempts),
      distribution,
      questions,
    },
  });
});

// GET /api/analytics/course/:courseId?batch=
exports.courseAnalytics = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) throw new ApiError(404, 'Course not found');
  assertCourseAccess(req.user, course);

  const agentIds = await audienceAgentIds({ batchId: req.query.batch, courseId: course._id });
  const agentFilter = agentIds ? { $in: agentIds } : undefined;
  const agentCount = agentIds ? agentIds.length : await User.countDocuments({ role: 'agent' });

  const [lessons, quizzes, progresses] = await Promise.all([
    Lesson.find({ course: course._id }).sort('order').select('title order'),
    Quiz.find({ course: course._id }).select('title questions'),
    Progress.find({ course: course._id, ...(agentFilter && { user: agentFilter }) }).select('completedLessons'),
  ]);

  // Lesson funnel: how many agents completed each lesson (in order).
  const completedSets = progresses.map((p) => new Set((p.completedLessons || []).map(String)));
  const lessonFunnel = lessons.map((l) => ({
    lessonId: l._id,
    title: l.title,
    order: l.order,
    completed: completedSets.filter((set) => set.has(String(l._id))).length,
  }));

  // Per-quiz mini summaries.
  const quizIds = quizzes.map((q) => q._id);
  const allAttempts = await QuizAttempt.find({ quiz: { $in: quizIds }, ...(agentFilter && { user: agentFilter }) }).select(
    'quiz user percentage passed attemptNumber'
  );
  const quizSummaries = quizzes.map((q) => ({
    quizId: q._id,
    title: q.title,
    questionCount: q.questions.length,
    ...summarizeAttempts(allAttempts.filter((a) => String(a.quiz) === String(q._id))),
  }));

  // Simulator usage by the audience.
  const simAttempts = await ScenarioAttempt.find(agentFilter ? { user: agentFilter } : {}).select('user percentage');
  const simulator = {
    attempts: simAttempts.length,
    agents: new Set(simAttempts.map((a) => String(a.user))).size,
    avgScore: round(mean(simAttempts.map((a) => a.percentage))),
  };

  res.json({
    success: true,
    data: {
      course: { _id: course._id, code: course.code, title: course.title },
      agentCount,
      lessonFunnel,
      quizzes: quizSummaries,
      simulator,
    },
  });
});

// GET /api/analytics/agent/:agentId
exports.agentAnalytics = asyncHandler(async (req, res) => {
  const agent = await User.findById(req.params.agentId).select('firstName lastName employeeId role batch');
  if (!agent || agent.role !== 'agent') throw new ApiError(404, 'Agent not found');
  if (req.user.role === 'trainer') {
    const batch = agent.batch ? await Batch.findById(agent.batch).select('trainer') : null;
    if (!batch || String(batch.trainer) !== String(req.user._id)) {
      throw new ApiError(403, 'You can only view agents in your own batches.');
    }
  }

  const [quizAttempts, simAttempts, evaluations] = await Promise.all([
    QuizAttempt.find({ user: agent._id }).sort('createdAt').populate('quiz', 'title').populate('course', 'category code'),
    ScenarioAttempt.find({ user: agent._id }).sort('createdAt').populate('scenario', 'title category'),
    Evaluation.find({ agent: agent._id }).sort('createdAt').select('overallScore createdAt'),
  ]);

  const quizTrend = quizAttempts.map((a) => ({ date: a.createdAt, quiz: a.quiz?.title || 'Quiz', percentage: a.percentage, passed: a.passed }));
  const simulatorTrend = simAttempts.map((a) => ({ date: a.createdAt, scenario: a.scenario?.title || 'Scenario', percentage: a.percentage, combinedScore: a.combinedScore ?? a.percentage }));
  const evaluationTrend = evaluations.map((e) => ({ date: e.createdAt, score: e.overallScore }));

  // Weakest category from quiz scores grouped by the course category.
  const byCategory = {};
  quizAttempts.forEach((a) => {
    const cat = a.course?.category || 'Other';
    (byCategory[cat] = byCategory[cat] || []).push(a.percentage);
  });
  const categoryAverages = Object.entries(byCategory).map(([category, scores]) => ({ category, averageScore: round(mean(scores)) }));
  const weakestCategory = categoryAverages.length ? categoryAverages.reduce((lo, c) => (c.averageScore < lo.averageScore ? c : lo)) : null;

  res.json({
    success: true,
    data: {
      agent: { _id: agent._id, firstName: agent.firstName, lastName: agent.lastName, employeeId: agent.employeeId },
      quizTrend,
      simulatorTrend,
      evaluationTrend,
      categoryAverages,
      weakestCategory,
    },
  });
});
