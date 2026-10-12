const Batch = require('../models/Batch');
const mongoose = require('mongoose');
const User = require('../models/User');
const Course = require('../models/Course');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');
const { paginate, searchFilter } = require('../utils/query');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notificationService');

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
  await audit(req, { action: 'batch.create', targetType: 'Batch', targetId: batch._id, targetLabel: batch.name });
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
  await audit(req, { action: 'batch.update', targetType: 'Batch', targetId: batch._id, targetLabel: batch.name, metadata: { fields: Object.keys(data) } });
  res.json({ success: true, message: 'Batch updated.', data: batch });
});

// PUT /api/batches/:id/agents   (admin) - replaces the batch membership with agentIds
exports.setAgents = asyncHandler(async (req, res) => {
  const requestedIds = req.body.agentIds.map(String);
  const duplicateIds = requestedIds.filter((id, index) => requestedIds.indexOf(id) !== index);
  if (duplicateIds.length) {
    throw new ApiError(400, 'Duplicate agent IDs are not allowed.');
  }

  const membershipVersion = Number(req.body.membershipVersion);
  const session = await mongoose.startSession();
  let batch;
  let newlyAdded;

  try {
    await session.withTransaction(async () => {
      batch = await Batch.findById(req.params.id).session(session);
      if (!batch) throw new ApiError(404, 'Batch not found');
      if (batch.membershipVersion !== membershipVersion) {
        throw new ApiError(409, 'Batch membership changed since you loaded it. Refresh the batch before trying again.');
      }

      const agents = await User.find({ _id: { $in: requestedIds } })
        .select('_id role batch')
        .session(session);
      if (agents.length !== requestedIds.length) {
        throw new ApiError(400, 'All members must be existing agent accounts.');
      }

      const nonAgents = agents.filter((agent) => agent.role !== 'agent');
      if (nonAgents.length) {
        throw new ApiError(400, 'Only existing agent accounts can be assigned to a batch.');
      }

      const otherBatchAgents = agents.filter(
        (agent) => agent.batch && String(agent.batch) !== String(batch._id)
      );
      if (otherBatchAgents.length) {
        throw new ApiError(409, 'One or more agents are already assigned to another batch. Remove that assignment before continuing.');
      }

      const existing = (await User.find({ batch: batch._id }).select('_id').session(session)).map((user) => String(user._id));
      newlyAdded = requestedIds.filter((id) => !existing.includes(id));

      await User.updateMany(
        { batch: batch._id, _id: { $nin: requestedIds } },
        { $set: { batch: null } },
        { session }
      );
      await User.updateMany(
        { _id: { $in: requestedIds }, role: 'agent' },
        { $set: { batch: batch._id } },
        { session }
      );

      batch.membershipVersion += 1;
      await batch.save({ session });
    });
  } finally {
    await session.endSession();
  }

  await audit(req, { action: 'batch.members', targetType: 'Batch', targetId: batch._id, targetLabel: batch.name, metadata: { total: requestedIds.length, added: newlyAdded.length } });
  await notify(newlyAdded, {
    type: 'batch.assigned',
    title: 'Added to a training batch',
    message: `You were added to ${batch.name} (${batch.account}). Your courses are now available.`,
    link: '/agent/courses',
  });
  res.json({ success: true, message: `Batch now has ${requestedIds.length} agent(s).`, data: { membershipVersion: batch.membershipVersion } });
});

// DELETE /api/batches/:id   (admin) - agents become unassigned
exports.deleteBatch = asyncHandler(async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) throw new ApiError(404, 'Batch not found');
  await User.updateMany({ batch: batch._id }, { $set: { batch: null } });
  const label = batch.name;
  const deletedId = batch._id;
  await batch.deleteOne();
  await audit(req, { action: 'batch.delete', targetType: 'Batch', targetId: deletedId, targetLabel: label });
  res.json({ success: true, message: 'Batch deleted.' });
});
