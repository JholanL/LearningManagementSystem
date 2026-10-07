const User = require('../models/User');
const Batch = require('../models/Batch');
const Course = require('../models/Course');
const Scenario = require('../models/Scenario');
const QuizAttempt = require('../models/QuizAttempt');
const ScenarioAttempt = require('../models/ScenarioAttempt');
const Certificate = require('../models/Certificate');
const Evaluation = require('../models/Evaluation');
const Progress = require('../models/Progress');
const asyncHandler = require('../utils/asyncHandler');
const { getAgentCourseIds } = require('../services/accessService');
const { buildProgressMatrix } = require('../services/progressService');

const avg = (nums) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null);
const countBy = (items, key) =>
  items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});

// GET /api/dashboard/admin
exports.adminDashboard = asyncHandler(async (_req, res) => {
  const [users, batches, courses, scenarioCount, certificateCount, recentUsers, recentCertificates] = await Promise.all([
    User.find().select('role isActive'),
    Batch.find().select('status'),
    Course.find().select('category isPublished'),
    Scenario.countDocuments(),
    Certificate.countDocuments(),
    User.find().sort('-createdAt').limit(5).select('firstName lastName email role createdAt'),
    Certificate.find()
      .sort('-issuedAt')
      .limit(5)
      .populate('user', 'firstName lastName')
      .populate('course', 'code title'),
  ]);

  res.json({
    success: true,
    data: {
      users: {
        total: users.length,
        byRole: countBy(users, 'role'),
        inactive: users.filter((u) => !u.isActive).length,
      },
      batches: { total: batches.length, byStatus: countBy(batches, 'status') },
      courses: {
        total: courses.length,
        published: courses.filter((c) => c.isPublished).length,
        byCategory: countBy(courses, 'category'),
      },
      scenarios: scenarioCount,
      certificatesIssued: certificateCount,
      recentUsers,
      recentCertificates,
    },
  });
});

// GET /api/dashboard/trainer
exports.trainerDashboard = asyncHandler(async (req, res) => {
  const me = req.user._id;
  const batches = await Batch.find({ trainer: me }).select('name account status startDate endDate').sort('-startDate');
  const batchIds = batches.map((b) => b._id);
  const agents = await User.find({ batch: { $in: batchIds }, role: 'agent' }).select('firstName lastName employeeId batch');
  const agentIds = agents.map((a) => a._id);

  const [myCourses, myScenarios, attempts, pendingAck, recentAttempts] = await Promise.all([
    Course.find({ createdBy: me }).select('isPublished'),
    Scenario.countDocuments({ createdBy: me }),
    QuizAttempt.find({ user: { $in: agentIds } })
      .select('user quiz percentage passed course')
      .populate('course', 'maxAttempts'),
    Evaluation.countDocuments({ evaluator: me, acknowledged: false }),
    QuizAttempt.find({ user: { $in: agentIds } })
      .sort('-createdAt')
      .limit(8)
      .populate('user', 'firstName lastName')
      .populate('quiz', 'title'),
  ]);

  // At-risk agents: average below 75% OR used all attempts on a quiz without passing
  const byAgent = {};
  attempts.forEach((a) => {
    const key = String(a.user);
    byAgent[key] = byAgent[key] || { scores: [], quizzes: {} };
    byAgent[key].scores.push(a.percentage);
    const q = (byAgent[key].quizzes[String(a.quiz)] = byAgent[key].quizzes[String(a.quiz)] || {
      count: 0,
      passed: false,
      max: a.course?.maxAttempts || 3,
    });
    q.count += 1;
    q.passed = q.passed || a.passed;
  });

  const atRiskAgents = agents
    .map((agent) => {
      const s = byAgent[String(agent._id)];
      if (!s) return null;
      const average = avg(s.scores);
      const lockedOut = Object.values(s.quizzes).filter((q) => !q.passed && q.count >= q.max).length;
      if (average >= 75 && lockedOut === 0) return null;
      return { agent, averageScore: average, quizzesLockedOut: lockedOut };
    })
    .filter(Boolean);

  const agentCounts = countBy(agents, 'batch');
  res.json({
    success: true,
    data: {
      batches: batches.map((b) => ({ ...b.toObject(), agentCount: agentCounts[String(b._id)] || 0 })),
      totalAgents: agents.length,
      courses: { total: myCourses.length, published: myCourses.filter((c) => c.isPublished).length },
      scenarios: myScenarios,
      averageQuizScore: avg(attempts.map((a) => a.percentage)),
      passRate: attempts.length ? Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100) : null,
      pendingAcknowledgments: pendingAck,
      atRiskAgents,
      recentAttempts,
    },
  });
});

// GET /api/dashboard/agent
exports.agentDashboard = asyncHandler(async (req, res) => {
  const me = req.user._id;
  const courseIds = await getAgentCourseIds(req.user);

  const [batch, courses, matrix, certificates, scenarioAttempts, latestEvaluation, pendingAck, recentAttempts, lastProgress] =
    await Promise.all([
      req.user.batch
        ? Batch.findById(req.user.batch).select('name account startDate endDate status').populate('trainer', 'firstName lastName')
        : null,
      Course.find({ _id: { $in: courseIds } }).select('code title category'),
      buildProgressMatrix([me], courseIds),
      Certificate.countDocuments({ user: me }),
      ScenarioAttempt.find({ user: me }).select('scenario percentage passed'),
      Evaluation.findOne({ agent: me }).sort('-createdAt').select('overallScore rating callType createdAt acknowledged'),
      Evaluation.countDocuments({ agent: me, acknowledged: false }),
      QuizAttempt.find({ user: me }).sort('-createdAt').limit(5).populate('quiz', 'title').select('quiz percentage passed createdAt'),
      Progress.findOne({ user: me, course: { $in: courseIds }, status: { $ne: 'completed' } })
        .sort('-lastAccessedAt')
        .populate('course', 'title code'),
    ]);

  const mine = matrix[String(me)];
  const courseStats = courses.map((c) => ({ course: c, ...mine[String(c._id)] }));
  const bestQuizScores = courseStats.flatMap((c) => Object.values(c.quizzes).filter((q) => q.attempts).map((q) => q.best));

  const bestPerScenario = {};
  scenarioAttempts.forEach((a) => {
    const k = String(a.scenario);
    bestPerScenario[k] = Math.max(bestPerScenario[k] || 0, a.percentage);
  });

  res.json({
    success: true,
    data: {
      batch,
      progress: {
        overallPercent: avg(courseStats.map((c) => c.percent)) ?? 0,
        totalCourses: courseStats.length,
        completedCourses: courseStats.filter((c) => c.status === 'completed').length,
        inProgressCourses: courseStats.filter((c) => c.status === 'in_progress').length,
        productionReady: courseStats.length > 0 && courseStats.every((c) => c.status === 'completed'),
      },
      courses: courseStats.map(({ course, percent, status }) => ({ course, percent, status })),
      averageQuizScore: avg(bestQuizScores),
      certificates,
      simulator: { scenariosPlayed: Object.keys(bestPerScenario).length, averageBestScore: avg(Object.values(bestPerScenario)) },
      latestEvaluation,
      pendingAcknowledgments: pendingAck,
      recentAttempts,
      continueLearning: lastProgress?.course || null,
    },
  });
});
