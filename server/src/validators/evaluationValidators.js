const { body } = require('express-validator');
const { CRITERIA } = require('../models/Evaluation');

const scoreRules = (isUpdate) =>
  Object.keys(CRITERIA).map((key) => {
    const chain = body(`scores.${key}`);
    return (isUpdate ? chain.optional() : chain)
      .isInt({ min: 1, max: 5 })
      .withMessage(`${CRITERIA[key].label} score must be 1-5`)
      .toInt();
  });

const evaluationBody = (isUpdate = false) => {
  const req = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    req(body('agent')).isMongoId().withMessage('Valid agent is required'),
    body('callType').optional().isIn(['Inbound', 'Outbound', 'Chat', 'Email']).withMessage('Invalid call type'),
    req(body('callSummary')).trim().notEmpty().withMessage('Call summary is required').isLength({ max: 1000 }),
    ...scoreRules(isUpdate),
    body('strengths').optional().trim().isLength({ max: 1000 }),
    body('areasForImprovement').optional().trim().isLength({ max: 1000 }),
    body('coachingPlan').optional().trim().isLength({ max: 1000 }),
  ];
};

const acknowledge = [body('agentComment').optional().trim().isLength({ max: 1000 })];

module.exports = {
  createEvaluation: evaluationBody(false),
  updateEvaluation: evaluationBody(true),
  acknowledge,
};
