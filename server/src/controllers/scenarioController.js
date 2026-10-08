const Scenario = require('../models/Scenario');
const ScenarioAttempt = require('../models/ScenarioAttempt');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');
const { paginate, searchFilter } = require('../utils/query');
const { computeDelivery } = require('../utils/deliveryMetrics');

const FIELDS = ['title', 'description', 'category', 'difficulty', 'customer', 'startStep', 'steps', 'passingScore'];
const MAX_STEP_SCORE = 10;

async function loadScenario(user, id) {
  const scenario = await Scenario.findById(id);
  if (!scenario) throw new ApiError(404, 'Scenario not found');
  if (user.role === 'agent' && !scenario.isPublished) throw new ApiError(404, 'Scenario not found');
  return scenario;
}

function assertCanEdit(user, scenario) {
  if (user.role === 'admin' || String(scenario.createdBy) === String(user._id)) return;
  throw new ApiError(403, 'Only the scenario owner or an admin can modify this scenario.');
}

// GET /api/scenarios?search=&category=&difficulty=&isPublished=&page=&limit=
exports.getScenarios = asyncHandler(async (req, res) => {
  const { search, category, difficulty, isPublished } = req.query;
  const filter = { ...searchFilter(search, ['title', 'description', 'customer.issue']) };
  if (category) filter.category = category;
  if (difficulty) filter.difficulty = difficulty;
  if (req.user.role === 'agent') filter.isPublished = true;
  else if (isPublished !== undefined && isPublished !== '') filter.isPublished = isPublished === 'true';

  const result = await paginate(Scenario, filter, req.query, {
    select: '-steps',
    populate: { path: 'createdBy', select: 'firstName lastName' },
  });

  let data = result.data.map((s) => s.toObject());
  if (req.user.role === 'agent') {
    const attempts = await ScenarioAttempt.find({ user: req.user._id, scenario: { $in: data.map((s) => s._id) } }).select(
      'scenario percentage passed'
    );
    data = data.map((s) => {
      const mine = attempts.filter((a) => String(a.scenario) === String(s._id));
      return {
        ...s,
        attempts: mine.length,
        bestScore: mine.length ? Math.max(...mine.map((a) => a.percentage)) : null,
        passed: mine.some((a) => a.passed),
      };
    });
  }
  res.json({ success: true, data, pagination: result.pagination });
});

// GET /api/scenarios/:id
// Trainer/Admin: full scenario. Agent: briefing + first step only (no scores).
exports.getScenario = asyncHandler(async (req, res) => {
  const scenario = await loadScenario(req.user, req.params.id);
  if (req.user.role !== 'agent') return res.json({ success: true, data: scenario });

  res.json({
    success: true,
    data: {
      _id: scenario._id,
      title: scenario.title,
      description: scenario.description,
      category: scenario.category,
      difficulty: scenario.difficulty,
      customer: scenario.customer,
      passingScore: scenario.passingScore,
      firstStep: scenario.publicStep(scenario.startStep),
    },
  });
});

// POST /api/scenarios   (trainer, admin)
exports.createScenario = asyncHandler(async (req, res) => {
  const scenario = await Scenario.create({ ...pick(req.body, FIELDS), createdBy: req.user._id });
  res.status(201).json({ success: true, message: 'Scenario created.', data: scenario });
});

// PUT /api/scenarios/:id   (owner trainer, admin)
exports.updateScenario = asyncHandler(async (req, res) => {
  const scenario = await loadScenario(req.user, req.params.id);
  assertCanEdit(req.user, scenario);
  Object.assign(scenario, pick(req.body, FIELDS));
  await scenario.save();
  res.json({ success: true, message: 'Scenario updated.', data: scenario });
});

// PATCH /api/scenarios/:id/publish   (owner trainer, admin)
exports.togglePublish = asyncHandler(async (req, res) => {
  const scenario = await loadScenario(req.user, req.params.id);
  assertCanEdit(req.user, scenario);
  scenario.isPublished = !scenario.isPublished;
  await scenario.save();
  res.json({ success: true, message: scenario.isPublished ? 'Scenario published.' : 'Scenario unpublished.', data: scenario });
});

// DELETE /api/scenarios/:id   (owner trainer, admin)
exports.deleteScenario = asyncHandler(async (req, res) => {
  const scenario = await loadScenario(req.user, req.params.id);
  assertCanEdit(req.user, scenario);
  await ScenarioAttempt.deleteMany({ scenario: scenario._id });
  await scenario.deleteOne();
  res.json({ success: true, message: 'Scenario deleted.' });
});

// POST /api/scenarios/:id/respond   { stepKey, optionIndex }
// Agent picks a response -> returns feedback for that choice and the next customer line.
exports.respond = asyncHandler(async (req, res) => {
  const scenario = await loadScenario(req.user, req.params.id);
  const step = scenario.getStep(req.body.stepKey);
  if (!step) throw new ApiError(400, 'Unknown step.');
  const option = step.options[req.body.optionIndex];
  if (!option) throw new ApiError(400, 'Unknown option.');

  res.json({
    success: true,
    data: {
      score: option.score,
      maxScore: MAX_STEP_SCORE,
      feedback: option.feedback,
      ended: !option.nextStep,
      nextStep: option.nextStep ? scenario.publicStep(option.nextStep) : null,
    },
  });
});

// POST /api/scenarios/:id/submit   { path: [{ stepKey, optionIndex }, ...] }
// Server re-validates the whole conversation path and computes the score.
exports.submit = asyncHandler(async (req, res) => {
  const scenario = await loadScenario(req.user, req.params.id);
  const { path } = req.body;

  let expectedKey = scenario.startStep;
  const scored = path.map((entry, i) => {
    if (entry.stepKey !== expectedKey) throw new ApiError(400, `Invalid path at step ${i + 1}.`);
    const step = scenario.getStep(entry.stepKey);
    const option = step.options[entry.optionIndex];
    if (!option) throw new ApiError(400, `Invalid option at step ${i + 1}.`);
    const isLast = i === path.length - 1;
    if (isLast && option.nextStep) throw new ApiError(400, 'The call has not ended yet.');
    expectedKey = option.nextStep;
    return {
      stepKey: entry.stepKey,
      optionIndex: entry.optionIndex,
      score: option.score,
      customerLine: step.customerLine,
      response: option.text,
      feedback: option.feedback,
    };
  });

  const totalScore = scored.reduce((sum, s) => sum + s.score, 0);
  const maxScore = scored.length * MAX_STEP_SCORE;
  const percentage = Math.round((totalScore / maxScore) * 100); // content score
  const passed = percentage >= scenario.passingScore;

  // ----- Voice mode: recompute delivery on the SERVER (ignore any client-sent score) -----
  const isVoice = req.body.mode === 'voice';
  let voiceTranscript;
  let delivery;
  let combinedScore = percentage; // text mode: combined = content

  if (isVoice) {
    const rawTranscript = Array.isArray(req.body.transcript) ? req.body.transcript : [];
    // Reject a transcript longer than this conversation could possibly produce
    // (at most one customer line + one agent reply per step taken).
    if (rawTranscript.length > scored.length * 2) {
      throw new ApiError(422, 'Transcript is longer than the conversation allows.');
    }

    // Sanitise/clamp what we store (text capped, speaker whitelisted).
    voiceTranscript = rawTranscript.slice(0, 60).map((e) => ({
      speaker: e.speaker === 'customer' ? 'customer' : 'agent',
      text: String(e.text || '').slice(0, 1000),
      stepKey: e.stepKey,
      offsetMs: Math.max(0, Number(e.offsetMs) || 0),
      durationMs: Math.max(0, Number(e.durationMs) || 0),
    }));

    const agentTexts = voiceTranscript.filter((e) => e.speaker === 'agent').map((e) => e.text);
    const timing = Array.isArray(req.body.timing) ? req.body.timing : [];
    delivery = computeDelivery({ agentTexts, timing }); // deliveryScore is OUR number, not the client's
    combinedScore = Math.round(percentage * 0.7 + delivery.deliveryScore * 0.3);
  }

  const attempt = await ScenarioAttempt.create({
    user: req.user._id,
    scenario: scenario._id,
    path: scored.map(({ stepKey, optionIndex, score }) => ({ stepKey, optionIndex, score })),
    totalScore,
    maxScore,
    percentage,
    passed,
    mode: isVoice ? 'voice' : 'text',
    ...(isVoice && { transcript: voiceTranscript, delivery }),
    combinedScore,
  });

  res.status(201).json({
    success: true,
    message: passed ? 'Great call handling!' : 'Keep practicing - review the feedback below.',
    data: {
      attemptId: attempt._id,
      totalScore,
      maxScore,
      percentage,
      passed,
      passingScore: scenario.passingScore,
      transcript: scored, // scored path (unchanged shape used by the results screen)
      mode: isVoice ? 'voice' : 'text',
      combinedScore,
      ...(isVoice && { delivery }),
    },
  });
});

// GET /api/scenarios/:id/attempts   Agent: own. Trainer/Admin: everyone.
exports.getAttempts = asyncHandler(async (req, res) => {
  await loadScenario(req.user, req.params.id);
  const filter = { scenario: req.params.id };
  if (req.user.role === 'agent') filter.user = req.user._id;
  const result = await paginate(ScenarioAttempt, filter, req.query, {
    populate: { path: 'user', select: 'firstName lastName employeeId' },
  });
  res.json({ success: true, ...result });
});
