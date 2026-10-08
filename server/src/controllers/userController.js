const User = require('../models/User');
const Batch = require('../models/Batch');
const Progress = require('../models/Progress');
const QuizAttempt = require('../models/QuizAttempt');
const ScenarioAttempt = require('../models/ScenarioAttempt');
const Certificate = require('../models/Certificate');
const Evaluation = require('../models/Evaluation');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');
const { paginate, searchFilter } = require('../utils/query');
const { audit } = require('../services/auditService');

const FIELDS = ['firstName', 'lastName', 'email', 'password', 'role', 'employeeId', 'phone', 'avatarUrl', 'batch', 'isActive'];

async function assertValidBatch(batchId, role) {
  if (!batchId) return;
  if (role !== 'agent') throw new ApiError(400, 'Only agents can be assigned to a batch.');
  if (!(await Batch.exists({ _id: batchId }))) throw new ApiError(404, 'Batch not found');
}

// GET /api/users?search=&role=&batch=&isActive=&page=&limit=   (admin)
exports.getUsers = asyncHandler(async (req, res) => {
  const { search, role, batch, isActive } = req.query;
  const filter = { ...searchFilter(search, ['firstName', 'lastName', 'email', 'employeeId']) };
  if (role) filter.role = role;
  if (batch) filter.batch = batch === 'none' ? null : batch;
  if (isActive !== undefined && isActive !== '') filter.isActive = isActive === 'true';

  const result = await paginate(User, filter, req.query, { populate: { path: 'batch', select: 'name account' } });
  res.json({ success: true, ...result });
});

// GET /api/users/:id   (admin)
exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate('batch', 'name account');
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ success: true, data: user });
});

// POST /api/users   (admin) - create admin / trainer / agent
exports.createUser = asyncHandler(async (req, res) => {
  const data = pick(req.body, FIELDS);
  await assertValidBatch(data.batch, data.role);
  if (await User.exists({ email: data.email })) throw new ApiError(409, 'Email is already registered.');
  const user = await User.create(data);
  await audit(req, { action: 'user.create', targetType: 'User', targetId: user._id, targetLabel: `${user.firstName} ${user.lastName}`, metadata: { role: user.role } });
  res.status(201).json({ success: true, message: 'User created.', data: user });
});

// PUT /api/users/:id   (admin)
exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('+tokenVersion');
  if (!user) throw new ApiError(404, 'User not found');

  const updates = pick(req.body, FIELDS);
  const isSelf = String(user._id) === String(req.user._id);
  if (isSelf && updates.role && updates.role !== 'admin') throw new ApiError(400, 'You cannot remove your own admin role.');
  if (isSelf && updates.isActive === false) throw new ApiError(400, 'You cannot deactivate your own account.');

  const nextRole = updates.role || user.role;
  if (nextRole !== 'agent') updates.batch = null; // only agents belong to batches
  else if (updates.batch !== undefined) await assertValidBatch(updates.batch, nextRole);

  if (nextRole !== 'trainer' && user.role === 'trainer' && (await Batch.exists({ trainer: user._id }))) {
    throw new ApiError(400, 'This trainer still handles batches. Reassign them first.');
  }

  // Changing password, role or deactivating forces a fresh login
  if (updates.password || (updates.role && updates.role !== user.role) || updates.isActive === false) {
    user.tokenVersion += 1;
  }

  Object.assign(user, updates);
  await user.save();
  await user.populate('batch', 'name account');
  // record WHICH fields changed, never their values (so no password ever lands in the log)
  await audit(req, { action: 'user.update', targetType: 'User', targetId: user._id, targetLabel: `${user.firstName} ${user.lastName}`, metadata: { fields: Object.keys(updates).filter((k) => k !== 'password') } });
  res.json({ success: true, message: 'User updated.', data: user });
});

// PATCH /api/users/:id/status   (admin) - activate / deactivate
exports.toggleStatus = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw new ApiError(400, 'You cannot deactivate your own account.');
  const user = await User.findById(req.params.id).select('+tokenVersion');
  if (!user) throw new ApiError(404, 'User not found');
  user.isActive = !user.isActive;
  if (!user.isActive) user.tokenVersion += 1; // kick out active sessions
  await user.save({ validateBeforeSave: false });
  await audit(req, { action: 'user.status', targetType: 'User', targetId: user._id, targetLabel: `${user.firstName} ${user.lastName}`, metadata: { isActive: user.isActive } });
  res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}.`, data: user });
});

// PATCH /api/users/:id/unlock   (admin) - clear a brute-force lockout
exports.unlockUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  await user.save({ validateBeforeSave: false });
  await audit(req, { action: 'user.unlock', targetType: 'User', targetId: user._id, targetLabel: `${user.firstName} ${user.lastName}` });
  res.json({ success: true, message: 'Account unlocked.', data: user });
});

// DELETE /api/users/:id   (admin) - also deletes the agent's learning records
exports.deleteUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw new ApiError(400, 'You cannot delete your own account.');
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.role === 'trainer' && (await Batch.exists({ trainer: user._id }))) {
    throw new ApiError(400, 'This trainer still handles batches. Reassign them first.');
  }

  await Promise.all([
    Progress.deleteMany({ user: user._id }),
    QuizAttempt.deleteMany({ user: user._id }),
    ScenarioAttempt.deleteMany({ user: user._id }),
    Certificate.deleteMany({ user: user._id }),
    Evaluation.deleteMany({ agent: user._id }),
  ]);
  const label = `${user.firstName} ${user.lastName}`; // snapshot before the record is gone
  const deletedId = user._id;
  await user.deleteOne();
  await audit(req, { action: 'user.delete', targetType: 'User', targetId: deletedId, targetLabel: label, metadata: { role: user.role, email: user.email } });
  res.json({ success: true, message: 'User deleted.' });
});
