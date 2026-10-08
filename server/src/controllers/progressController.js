const Batch = require('../models/Batch');
const User = require('../models/User');
const Course = require('../models/Course');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getAgentCourseIds } = require('../services/accessService');
const { buildProgressMatrix } = require('../services/progressService');

const summarize = (p) => ({
  percent: p.percent,
  status: p.status,
  completedLessons: p.completedLessons,
  totalLessons: p.totalLessons,
  passedQuizzes: p.passedQuizzes,
  totalQuizzes: p.totalQuizzes,
  averageBestScore: p.averageBestScore,
});

// GET /api/progress/me   (agent) - progress in every assigned course
exports.getMyProgress = asyncHandler(async (req, res) => {
  const courseIds = await getAgentCourseIds(req.user);
  const courses = await Course.find({ _id: { $in: courseIds } }).select('code title category');
  const matrix = await buildProgressMatrix([req.user._id], courseIds);
  const mine = matrix[String(req.user._id)];

  const data = courses.map((c) => ({ course: c, ...summarize(mine[String(c._id)]) }));
  const overall = data.length ? Math.round(data.reduce((s, d) => s + d.percent, 0) / data.length) : 0;
  res.json({
    success: true,
    data: {
      overallPercent: overall,
      productionReady: data.length > 0 && data.every((d) => d.status === 'completed'),
      courses: data,
    },
  });
});

// GET /api/progress/batch/:batchId   (trainer of the batch, admin)
// Agents x courses matrix - great for a "class record" table.
exports.getBatchProgress = asyncHandler(async (req, res) => {
  const batch = await Batch.findById(req.params.batchId).populate('courses', 'code title isPublished');
  if (!batch) throw new ApiError(404, 'Batch not found');
  if (req.user.role === 'trainer' && String(batch.trainer) !== String(req.user._id)) {
    throw new ApiError(403, 'You can only view your own batches.');
  }

  const courses = batch.courses.filter((c) => c.isPublished);
  const agents = await User.find({ batch: batch._id, role: 'agent' }).select('firstName lastName employeeId productionStatus').sort('lastName');
  const matrix = await buildProgressMatrix(
    agents.map((a) => a._id),
    courses.map((c) => c._id)
  );

  const rows = agents.map((a) => {
    const cells = courses.map((c) => ({ courseId: c._id, ...summarize(matrix[String(a._id)][String(c._id)]) }));
    const overall = cells.length ? Math.round(cells.reduce((s, c) => s + c.percent, 0) / cells.length) : 0;
    return {
      agent: a,
      overallPercent: overall,
      productionReady: cells.length > 0 && cells.every((c) => c.status === 'completed'),
      courses: cells,
    };
  });

  res.json({
    success: true,
    data: {
      batch: { _id: batch._id, name: batch.name, account: batch.account },
      courses: courses.map((c) => ({ _id: c._id, code: c.code, title: c.title })),
      rows,
    },
  });
});
