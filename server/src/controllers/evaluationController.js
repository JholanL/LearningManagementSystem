const Evaluation = require('../models/Evaluation');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');
const { paginate, searchFilter } = require('../utils/query');
const { getTrainerBatchIds } = require('../services/accessService');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notificationService');

const FIELDS = ['agent', 'callType', 'callSummary', 'scores', 'strengths', 'areasForImprovement', 'coachingPlan'];
const { CRITERIA } = Evaluation;

async function assertTrainerHandlesAgent(user, agentId) {
  const agent = await User.findById(agentId);
  if (!agent || agent.role !== 'agent') throw new ApiError(400, 'Selected user is not an agent.');
  if (user.role === 'admin') return agent;
  const batchIds = (await getTrainerBatchIds(user._id)).map(String);
  if (!agent.batch || !batchIds.includes(String(agent.batch))) {
    throw new ApiError(403, 'You can only evaluate agents in your own batches.');
  }
  return agent;
}

async function loadEvaluation(user, id) {
  const evaluation = await Evaluation.findById(id)
    .populate('agent', 'firstName lastName employeeId batch')
    .populate('evaluator', 'firstName lastName');
  if (!evaluation) throw new ApiError(404, 'Evaluation not found');

  const isAgentOwner = String(evaluation.agent._id) === String(user._id);
  const isEvaluator = String(evaluation.evaluator._id) === String(user._id);
  if (user.role === 'agent' && !isAgentOwner) throw new ApiError(403, 'You can only view your own evaluations.');
  if (user.role === 'trainer' && !isEvaluator) throw new ApiError(403, 'You can only view evaluations you created.');
  return evaluation;
}

// GET /api/evaluations/criteria  - labels and weights for building the scorecard form
exports.getCriteria = (_req, res) => res.json({ success: true, data: CRITERIA });

// GET /api/evaluations?search=&agent=&acknowledged=&page=&limit=
// Agent: own. Trainer: ones they wrote. Admin: all.
exports.getEvaluations = asyncHandler(async (req, res) => {
  const { search, agent, acknowledged } = req.query;
  const filter = { ...searchFilter(search, ['callSummary']) };
  if (req.user.role === 'agent') filter.agent = req.user._id;
  else if (agent) filter.agent = agent;
  if (req.user.role === 'trainer') filter.evaluator = req.user._id;
  if (acknowledged !== undefined && acknowledged !== '') filter.acknowledged = acknowledged === 'true';

  const result = await paginate(Evaluation, filter, req.query, {
    populate: [
      { path: 'agent', select: 'firstName lastName employeeId' },
      { path: 'evaluator', select: 'firstName lastName' },
    ],
  });
  res.json({ success: true, ...result });
});

// GET /api/evaluations/:id
exports.getEvaluation = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await loadEvaluation(req.user, req.params.id) });
});

// POST /api/evaluations   (trainer, admin)
exports.createEvaluation = asyncHandler(async (req, res) => {
  const data = pick(req.body, FIELDS);
  const agent = await assertTrainerHandlesAgent(req.user, data.agent);
  const evaluation = await Evaluation.create({ ...data, evaluator: req.user._id });

  await audit(req, { action: 'evaluation.create', targetType: 'Evaluation', targetId: evaluation._id, targetLabel: `${agent.firstName} ${agent.lastName}`, metadata: { overallScore: evaluation.overallScore } });
  await notify(agent._id, {
    type: 'evaluation.new',
    title: 'New QA evaluation',
    message: `${req.user.firstName} ${req.user.lastName} scored your call ${evaluation.overallScore}% (${evaluation.rating}).`,
    link: '/agent/evaluations',
  });
  res.status(201).json({ success: true, message: 'Evaluation saved.', data: evaluation });
});

// PUT /api/evaluations/:id   (evaluator, admin) - locked once the agent acknowledges it
exports.updateEvaluation = asyncHandler(async (req, res) => {
  const evaluation = await loadEvaluation(req.user, req.params.id);
  if (evaluation.acknowledged) throw new ApiError(400, 'This evaluation was already acknowledged and can no longer be edited.');

  const data = pick(req.body, FIELDS);
  if (data.agent) await assertTrainerHandlesAgent(req.user, data.agent);
  if (data.scores) data.scores = { ...evaluation.toObject().scores, ...data.scores }; // allow partial score updates
  Object.assign(evaluation, data);
  await evaluation.save();
  res.json({ success: true, message: 'Evaluation updated.', data: evaluation });
});

// DELETE /api/evaluations/:id   (evaluator, admin)
exports.deleteEvaluation = asyncHandler(async (req, res) => {
  const evaluation = await loadEvaluation(req.user, req.params.id);
  await evaluation.deleteOne();
  res.json({ success: true, message: 'Evaluation deleted.' });
});

// PATCH /api/evaluations/:id/acknowledge   (agent) { agentComment }
exports.acknowledge = asyncHandler(async (req, res) => {
  const evaluation = await loadEvaluation(req.user, req.params.id);
  if (evaluation.acknowledged) throw new ApiError(400, 'Already acknowledged.');
  evaluation.acknowledged = true;
  evaluation.acknowledgedAt = new Date();
  evaluation.agentComment = req.body.agentComment;
  await evaluation.save();
  res.json({ success: true, message: 'Evaluation acknowledged.', data: evaluation });
});
