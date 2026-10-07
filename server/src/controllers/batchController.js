const Batch = require('../models/Batch');
const User = require('../models/User');
const Course = require('../models/Course');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');
const { paginate, searchFilter } = require('../utils/query');

const FIELDS = ['name', 'account', 'description', 'trainer', 'courses', 'startDate', 'endDate', 'status'];

async function validateRefs({ trainer, courses }) {
  if (trainer) {
    const t = await User.findById(trainer);
    if (!t || t.role !== 'trainer') throw new ApiError(400, 'Selected trainer is not a trainer account.');
  }
  if (courses && courses.length) {
    const count = await Course.countDocuments({ _id: { $in: courses } });
    if (count !== new Set(courses.map(String)).size) throw new ApiError(400, 'One or more courses do not exist.');
  }
}

function assertCanViewBatch(user, batch) {
  if (user.role === 'admin') return;
  if (user.role === 'trainer' && String(batch.trainer._id || batch.trainer) === String(user._id)) return;
  throw new ApiError(403, 'You can only view your own batches.');
}

// GET /api/batches?search=&status=&page=&limit=   (admin: all, trainer: own)
exports.getBatches = asyncHandler(async (req, res) => {
  const filter = { ...searchFilter(req.query.search, ['name', 'account']) };
  if (req.query.status) filter.status = req.query.status;
  if (req.user.role === 'trainer') filter.trainer = req.user._id;

  const result = await paginate(Batch, filter, req.query, {
    sort: '-startDate',
    populate: { path: 'trainer', select: 'firstName lastName email' },
  });

  // Attach number of agents per batch
  const counts = await Promise.all(result.data.map((b) => User.countDocuments({ batch: b._id, role: 'agent' })));
  const data = result.data.map((b, i) => ({ ...b.toObject(), agentCount: counts[i] }));
  res.json({ success: true, data, pagination: result.pagination });
});

// GET /api/batches/:id   - includes agents and curriculum
exports.getBatch = asyncHandler(async (req, res) => {
  const batch = await Batch.findById(req.params.id)
    .populate('trainer', 'firstName lastName email')
    .populate('courses', 'code title category isPublished');
  if (!batch) throw new ApiError(404, 'Batch not found');
  assertCanViewBatch(req.user, batch);

  const agents = await User.find({ batch: batch._id, role: 'agent' })
    .select('firstName lastName email employeeId isActive lastLogin')
    .sort('lastName');
  res.json({ success: true, data: { ...batch.toObject(), agents } });
});

// POST /api/batches   (admin)
exports.createBatch = asyncHandler(async (req, res) => {
  const data = pick(req.body, FIELDS);
  await validateRefs(data);
  const batch = await Batch.create(data);
  res.status(201).json({ success: true, message: 'Batch created.', data: batch });
});

// PUT /api/batches/:id   (admin)
exports.updateBatch = asyncHandler(async (req, res) => {
  const data = pick(req.body, FIELDS);
  await validateRefs(data);
  const batch = await Batch.findById(req.params.id);
  if (!batch) throw new ApiError(404, 'Batch not found');
  Object.assign(batch, data);
  if (batch.endDate < batch.startDate) throw new ApiError(422, 'End date must be on or after the start date');
  await batch.save();
  res.json({ success: true, message: 'Batch updated.', data: batch });
});

// PUT /api/batches/:id/agents   (admin) - replaces the batch membership with agentIds
exports.setAgents = asyncHandler(async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) throw new ApiError(404, 'Batch not found');

  const agentIds = [...new Set(req.body.agentIds.map(String))];
  const agents = await User.countDocuments({ _id: { $in: agentIds }, role: 'agent' });
  if (agents !== agentIds.length) throw new ApiError(400, 'All members must be existing agent accounts.');

  await User.updateMany({ batch: batch._id, _id: { $nin: agentIds } }, { $set: { batch: null } });
  await User.updateMany({ _id: { $in: agentIds } }, { $set: { batch: batch._id } });
  res.json({ success: true, message: `Batch now has ${agentIds.length} agent(s).` });
});

// DELETE /api/batches/:id   (admin) - agents become unassigned
exports.deleteBatch = asyncHandler(async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) throw new ApiError(404, 'Batch not found');
  await User.updateMany({ batch: batch._id }, { $set: { batch: null } });
  await batch.deleteOne();
  res.json({ success: true, message: 'Batch deleted.' });
});
