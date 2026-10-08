const Endorsement = require('../models/Endorsement');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Course = require('../models/Course');
const Evaluation = require('../models/Evaluation');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { paginate } = require('../utils/query');
const { computeReadiness } = require('../services/readinessService');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notificationService');

const READINESS_MIN = 80;
const fn = (u) => `${u.firstName} ${u.lastName}`;

// Load an agent and check the caller may act on them (trainer of their batch, or admin).
async function loadAgentForTrainer(user, agentId) {
  const agent = await User.findById(agentId);
  if (!agent || agent.role !== 'agent') throw new ApiError(404, 'Agent not found');
  if (user.role === 'trainer') {
    const batch = agent.batch ? await Batch.findById(agent.batch).select('trainer') : null;
    if (!batch || String(batch.trainer) !== String(user._id)) {
      throw new ApiError(403, 'You can only act on agents in your own batches.');
    }
  }
  return agent;
}

// Build the eligibility checklist + a metrics snapshot for an agent.
async function evaluateEligibility(agent) {
  const batch = agent.batch ? await Batch.findById(agent.batch).select('courses') : null;
  const courses = batch ? await Course.find({ _id: { $in: batch.courses }, isPublished: true }).select('_id') : [];
  const readiness = (await computeReadiness([agent._id], courses.map((c) => c._id)))[String(agent._id)];

  const unacknowledged = await Evaluation.countDocuments({ agent: agent._id, acknowledged: false });
  const existing = await Endorsement.findOne({ agent: agent._id, status: { $in: ['pending', 'approved'] } });

  const checklist = [
    { key: 'batch', rule: 'Active agent in your batch', passed: !!batch && agent.isActive, detail: !batch ? 'Not assigned to a batch' : !agent.isActive ? 'Account is deactivated' : 'OK' },
    { key: 'courses', rule: 'All batch courses completed', passed: readiness.productionReady, detail: `${readiness.coursesCompleted}/${readiness.totalCourses} courses completed` },
    { key: 'readiness', rule: `Readiness score ≥ ${READINESS_MIN}`, passed: readiness.readinessScore >= READINESS_MIN, detail: `Readiness ${readiness.readinessScore}` },
    { key: 'evaluations', rule: 'All QA evaluations acknowledged', passed: unacknowledged === 0, detail: unacknowledged ? `${unacknowledged} unacknowledged` : 'OK' },
    { key: 'endorsement', rule: 'No pending or approved endorsement', passed: !existing, detail: existing ? `Already ${existing.status}` : 'OK' },
  ];

  const snapshot = {
    overallPercent: readiness.overallPercent,
    averageQuizScore: readiness.averageQuizScore,
    averageSimulatorScore: readiness.averageSimulatorScore,
    averageEvaluationScore: readiness.averageEvaluationScore,
    readinessScore: readiness.readinessScore,
    coursesCompleted: readiness.coursesCompleted,
    totalCourses: readiness.totalCourses,
  };

  return { eligible: checklist.every((c) => c.passed), checklist, snapshot, batchId: agent.batch };
}

// GET /api/endorsements/eligibility/:agentId   (trainer of batch, admin)
exports.getEligibility = asyncHandler(async (req, res) => {
  const agent = await loadAgentForTrainer(req.user, req.params.agentId);
  const { eligible, checklist, snapshot } = await evaluateEligibility(agent);
  res.json({ success: true, data: { agent: { _id: agent._id, firstName: agent.firstName, lastName: agent.lastName, productionStatus: agent.productionStatus }, eligible, checklist, snapshot } });
});

// POST /api/endorsements   { agentId, note }   (trainer)
exports.createEndorsement = asyncHandler(async (req, res) => {
  const agent = await loadAgentForTrainer(req.user, req.body.agentId);
  const { eligible, checklist, snapshot, batchId } = await evaluateEligibility(agent);
  if (!eligible) throw new ApiError(400, 'This agent is not eligible for endorsement yet.', checklist);

  const endorsement = await Endorsement.create({
    agent: agent._id,
    batch: batchId,
    requestedBy: req.user._id,
    trainerNote: req.body.note,
    snapshot,
  });
  agent.productionStatus = 'endorsed';
  await agent.save({ validateBeforeSave: false });

  await audit(req, { action: 'endorsement.request', targetType: 'User', targetId: agent._id, targetLabel: fn(agent), metadata: { readinessScore: snapshot.readinessScore } });
  const admins = (await User.find({ role: 'admin', isActive: true }).select('_id')).map((a) => a._id);
  await notify(admins, {
    type: 'endorsement.requested',
    title: 'Endorsement request',
    message: `${fn(req.user)} endorsed ${fn(agent)} for production.`,
    link: '/admin/endorsements',
  });

  res.status(201).json({ success: true, message: 'Endorsement submitted for admin approval.', data: endorsement });
});

// GET /api/endorsements?status=&batch=&page=   (admin all; trainer own requests; agent own)
exports.getEndorsements = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.batch) filter.batch = req.query.batch;
  if (req.user.role === 'trainer') filter.requestedBy = req.user._id;
  else if (req.user.role === 'agent') filter.agent = req.user._id;

  const result = await paginate(Endorsement, filter, req.query, {
    populate: [
      { path: 'agent', select: 'firstName lastName employeeId productionStatus' },
      { path: 'requestedBy', select: 'firstName lastName' },
      { path: 'batch', select: 'name account' },
      { path: 'decidedBy', select: 'firstName lastName' },
    ],
  });
  res.json({ success: true, ...result });
});

// Shared decision handler for approve / reject / revoke.
async function decide(req, { from, newStatus, newProductionStatus, action, setGoLive }) {
  const endorsement = await Endorsement.findById(req.params.id).populate('agent', 'firstName lastName').populate('requestedBy', 'firstName lastName');
  if (!endorsement) throw new ApiError(404, 'Endorsement not found');
  if (!from.includes(endorsement.status)) throw new ApiError(400, `Only ${from.join(' or ')} endorsements can be ${newStatus}.`);

  endorsement.status = newStatus;
  endorsement.decisionNote = req.body.note;
  endorsement.decidedBy = req.user._id;
  endorsement.decidedAt = new Date();
  await endorsement.save();

  await User.updateOne(
    { _id: endorsement.agent._id },
    { $set: { productionStatus: newProductionStatus, ...(setGoLive !== undefined && { goLiveAt: setGoLive }) } }
  );

  await audit(req, { action, targetType: 'User', targetId: endorsement.agent._id, targetLabel: fn(endorsement.agent), metadata: { endorsementId: String(endorsement._id) } });
  const verb = { approved: 'approved', rejected: 'rejected', revoked: 'revoked' }[newStatus];
  await notify(endorsement.agent._id, { type: 'endorsement.decided', title: `Endorsement ${verb}`, message: `Your production endorsement was ${verb}.`, link: '/agent' });
  await notify(endorsement.requestedBy._id, { type: 'endorsement.decided', title: `Endorsement ${verb}`, message: `${fn(endorsement.agent)}'s endorsement was ${verb}.`, link: `/trainer/batches/${endorsement.batch}` });

  return endorsement;
}

// PATCH /api/endorsements/:id/approve   (admin)
exports.approve = asyncHandler(async (req, res) => {
  const e = await decide(req, { from: ['pending'], newStatus: 'approved', newProductionStatus: 'production', action: 'endorsement.approve', setGoLive: new Date() });
  res.json({ success: true, message: 'Endorsement approved. Agent is now in production.', data: e });
});

// PATCH /api/endorsements/:id/reject   (admin) - note required (validator)
exports.reject = asyncHandler(async (req, res) => {
  const e = await decide(req, { from: ['pending'], newStatus: 'rejected', newProductionStatus: 'in_training', action: 'endorsement.reject' });
  res.json({ success: true, message: 'Endorsement rejected.', data: e });
});

// PATCH /api/endorsements/:id/revoke   (admin) - for approved endorsements
exports.revoke = asyncHandler(async (req, res) => {
  const e = await decide(req, { from: ['approved'], newStatus: 'revoked', newProductionStatus: 'in_training', action: 'endorsement.revoke', setGoLive: null });
  res.json({ success: true, message: 'Endorsement revoked.', data: e });
});
