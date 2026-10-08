const Batch = require('../models/Batch');
const User = require('../models/User');
const Course = require('../models/Course');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { computeReadiness, WEIGHTS } = require('../services/readinessService');

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
  const agents = await User.find({ batch: batch._id, role: 'agent', isActive: true }).select('firstName lastName employeeId avatarUrl productionStatus');
  const readiness = await computeReadiness(agents.map((a) => a._id), courseIds);

  const rows = agents.map((agent) => {
    const r = readiness[String(agent._id)];
    return {
      agent,
      isMe: String(agent._id) === String(req.user._id),
      coursesCompleted: r.coursesCompleted,
      totalCourses: r.totalCourses,
      averageQuizScore: r.averageQuizScore,
      averageSimulatorScore: r.averageSimulatorScore,
      averageEvaluationScore: r.averageEvaluationScore,
      readinessScore: r.readinessScore,
    };
  });

  rows.sort((a, b) => b.readinessScore - a.readinessScore || b.coursesCompleted - a.coursesCompleted);
  rows.forEach((r, i) => (r.rank = i + 1));

  res.json({
    success: true,
    data: { batch: { _id: batch._id, name: batch.name, account: batch.account }, weights: WEIGHTS, rows },
  });
});
