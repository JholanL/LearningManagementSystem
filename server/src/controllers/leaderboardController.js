const Batch = require('../models/Batch');
const User = require('../models/User');
const Course = require('../models/Course');
const ScenarioAttempt = require('../models/ScenarioAttempt');
const Evaluation = require('../models/Evaluation');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { buildProgressMatrix } = require('../services/progressService');

const avg = (nums) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null);

// Readiness Score = weighted average of available components
// Quiz 50% + Call Simulator 30% + QA Evaluations 20% (re-weighted if a component has no data yet)
const WEIGHTS = { quiz: 0.5, simulator: 0.3, evaluation: 0.2 };
function readinessScore(parts) {
  let total = 0;
  let weight = 0;
  Object.entries(WEIGHTS).forEach(([key, w]) => {
    if (parts[key] !== null) {
      total += parts[key] * w;
      weight += w;
    }
  });
  return weight ? Math.round(total / weight) : 0;
}

// GET /api/leaderboard?batch=<id>
// Agent: always their own batch. Trainer: own batches. Admin: any batch.
exports.getLeaderboard = asyncHandler(async (req, res) => {
  let batchId = req.query.batch;
  if (req.user.role === 'agent') batchId = req.user.batch;
  if (!batchId) throw new ApiError(400, req.user.role === 'agent' ? 'You are not assigned to a batch yet.' : 'batch query is required');

  const batch = await Batch.findById(batchId).select('name account trainer courses');
  if (!batch) throw new ApiError(404, 'Batch not found');
  if (req.user.role === 'trainer' && String(batch.trainer) !== String(req.user._id)) {
    throw new ApiError(403, 'You can only view your own batches.');
  }

  const courses = await Course.find({ _id: { $in: batch.courses }, isPublished: true }).select('_id');
  const courseIds = courses.map((c) => c._id);
  const agents = await User.find({ batch: batch._id, role: 'agent', isActive: true }).select('firstName lastName employeeId avatarUrl');
  const agentIds = agents.map((a) => a._id);

  const [matrix, scenarioAttempts, evaluations] = await Promise.all([
    buildProgressMatrix(agentIds, courseIds),
    ScenarioAttempt.find({ user: { $in: agentIds } }).select('user scenario percentage'),
    Evaluation.find({ agent: { $in: agentIds } }).select('agent overallScore'),
  ]);

  const rows = agents.map((agent) => {
    const id = String(agent._id);
    const cells = Object.values(matrix[id] || {});
    const quizBests = cells.flatMap((c) => Object.values(c.quizzes).filter((q) => q.attempts).map((q) => q.best));

    const scenarioBest = {};
    scenarioAttempts
      .filter((a) => String(a.user) === id)
      .forEach((a) => (scenarioBest[String(a.scenario)] = Math.max(scenarioBest[String(a.scenario)] || 0, a.percentage)));

    const parts = {
      quiz: avg(quizBests),
      simulator: avg(Object.values(scenarioBest)),
      evaluation: avg(evaluations.filter((e) => String(e.agent) === id).map((e) => e.overallScore)),
    };

    return {
      agent,
      isMe: id === String(req.user._id),
      coursesCompleted: cells.filter((c) => c.status === 'completed').length,
      totalCourses: cells.length,
      averageQuizScore: parts.quiz,
      averageSimulatorScore: parts.simulator,
      averageEvaluationScore: parts.evaluation,
      readinessScore: readinessScore(parts),
    };
  });

  rows.sort((a, b) => b.readinessScore - a.readinessScore || b.coursesCompleted - a.coursesCompleted);
  rows.forEach((r, i) => (r.rank = i + 1));

  res.json({
    success: true,
    data: { batch: { _id: batch._id, name: batch.name, account: batch.account }, weights: WEIGHTS, rows },
  });
});
