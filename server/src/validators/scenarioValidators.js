const { body } = require('express-validator');

const scenarioBody = (isUpdate = false) => {
  const req = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    req(body('title')).trim().notEmpty().withMessage('Title is required').isLength({ max: 150 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    req(body('category'))
      .isIn(['Billing', 'Technical', 'Sales', 'Complaint', 'Account'])
      .withMessage('Invalid category'),
    body('difficulty').optional().isIn(['Easy', 'Medium', 'Hard']).withMessage('Invalid difficulty'),
    req(body('customer.name')).trim().notEmpty().withMessage('Customer name is required'),
    body('customer.mood').optional().isIn(['calm', 'confused', 'frustrated', 'irate']).withMessage('Invalid mood'),
    req(body('customer.issue')).trim().notEmpty().withMessage('Customer issue is required'),
    req(body('startStep')).trim().notEmpty().withMessage('startStep is required'),
    req(body('steps')).isArray({ min: 1, max: 30 }).withMessage('Provide 1-30 steps'),
    body('steps.*.key').trim().notEmpty().withMessage('Each step needs a key'),
    body('steps.*.customerLine').trim().notEmpty().withMessage('Each step needs a customer line'),
    body('steps.*.options').isArray({ min: 2, max: 4 }).withMessage('Each step needs 2-4 options'),
    body('steps.*.options.*.text').trim().notEmpty().withMessage('Option text is required'),
    body('steps.*.options.*.score').isInt({ min: 0, max: 10 }).withMessage('Option score must be 0-10').toInt(),
    body('steps.*.options.*.feedback').optional().trim().isLength({ max: 500 }),
    body('steps.*.options.*.keywords').optional().isArray({ max: 10 }).withMessage('Up to 10 keywords per option'),
    body('steps.*.options.*.keywords.*').optional().isString().trim().isLength({ max: 30 }),
    body('passingScore').optional().isInt({ min: 1, max: 100 }).toInt(),
  ];
};

const respond = [
  body('stepKey').trim().notEmpty().withMessage('stepKey is required'),
  body('optionIndex').isInt({ min: 0, max: 3 }).withMessage('optionIndex must be 0-3').toInt(),
];

const submit = [
  body('path').isArray({ min: 1, max: 30 }).withMessage('path must be a non-empty array'),
  body('path.*.stepKey').trim().notEmpty(),
  body('path.*.optionIndex').isInt({ min: 0, max: 3 }).toInt(),
  // Optional voice-mode payload (feature 1)
  body('mode').optional().isIn(['text', 'voice']).withMessage('mode must be text or voice'),
  body('transcript').optional().isArray({ max: 60 }).withMessage('Transcript is too long'),
  body('transcript.*.speaker').optional().isIn(['customer', 'agent']),
  body('transcript.*.text').optional().isString().isLength({ max: 1000 }).withMessage('Transcript line too long'),
  body('timing').optional().isArray({ max: 60 }),
  body('timing.*.silenceBeforeMs').optional().isNumeric(),
  body('timing.*.durationMs').optional().isNumeric(),
];

module.exports = {
  createScenario: scenarioBody(false),
  updateScenario: scenarioBody(true),
  respond,
  submit,
};
