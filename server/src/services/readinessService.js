const ScenarioAttempt = require('../models/ScenarioAttempt');
const Evaluation = require('../models/Evaluation');
const { buildProgressMatrix } = require('./progressService');

const avg = (nums) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null);

// Readiness Score = Quiz 50% + Call Simulator 30% + QA Evaluations 20%
// (re-weighted if a component has no data yet). Shared by the leaderboard and
// the go-live endorsement eligibility check.
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

/**
 * Compute readiness metrics for each agent across the given courses.
 * Returns: { [agentId]: { overallPercent, averageQuizScore, averageSimulatorScore,
 *   averageEvaluationScore, readinessScore, coursesCompleted, totalCourses, productionReady } }
 */
async function computeReadiness(agentIds, courseIds) {
  const [matrix, scenarioAttempts, evaluations] = await Promise.all([
    buildProgressMatrix(agentIds, courseIds),
    ScenarioAttempt.find({ user: { $in: agentIds } }).select('user scenario percentage'),
    Evaluation.find({ agent: { $in: agentIds } }).select('agent overallScore'),
  ]);

  const result = {};
  agentIds.forEach((agent) => {
    const id = String(agent);
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

    result[id] = {
      overallPercent: cells.length ? Math.round(cells.reduce((s, c) => s + c.percent, 0) / cells.length) : 0,
      averageQuizScore: parts.quiz,
      averageSimulatorScore: parts.simulator,
      averageEvaluationScore: parts.evaluation,
      readinessScore: readinessScore(parts),
      coursesCompleted: cells.filter((c) => c.status === 'completed').length,
      totalCourses: cells.length,
      productionReady: cells.length > 0 && cells.every((c) => c.status === 'completed'),
    };
  });
  return result;
}

module.exports = { computeReadiness, readinessScore, WEIGHTS };
