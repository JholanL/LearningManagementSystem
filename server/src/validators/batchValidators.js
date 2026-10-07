const { body } = require('express-validator');

const batchBody = (isUpdate = false) => {
  const req = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    req(body('name')).trim().notEmpty().withMessage('Batch name is required').isLength({ max: 60 }),
    req(body('account')).trim().notEmpty().withMessage('Account is required').isLength({ max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    req(body('trainer')).isMongoId().withMessage('Valid trainer is required'),
    body('courses').optional().isArray().withMessage('courses must be an array'),
    body('courses.*').optional().isMongoId().withMessage('Invalid course id'),
    req(body('startDate')).isISO8601().withMessage('Valid start date is required').toDate(),
    req(body('endDate'))
      .isISO8601()
      .withMessage('Valid end date is required')
      .toDate()
      .custom((end, { req: r }) => !r.body.startDate || new Date(end) >= new Date(r.body.startDate))
      .withMessage('End date must be on or after the start date'),
    body('status').optional().isIn(['upcoming', 'ongoing', 'completed']).withMessage('Invalid status'),
  ];
};

const setAgents = [
  body('agentIds').isArray().withMessage('agentIds must be an array'),
  body('agentIds.*').isMongoId().withMessage('Invalid agent id'),
];

module.exports = { createBatch: batchBody(false), updateBatch: batchBody(true), setAgents };
