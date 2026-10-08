const { body } = require('express-validator');

const create = [
  body('agentId').isMongoId().withMessage('Invalid agent id'),
  body('note').optional().trim().isLength({ max: 1000 }),
];

const decision = [body('note').optional().trim().isLength({ max: 1000 })];

const reject = [body('note').trim().notEmpty().withMessage('A rejection reason is required').isLength({ max: 1000 })];

module.exports = { create, decision, reject };
