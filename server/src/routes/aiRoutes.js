const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/aiController');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin', 'trainer'));

router.post(
  '/generate-quiz',
  [body('text').isString().withMessage('text is required'), body('count').optional().isInt({ min: 1, max: 10 }).toInt()],
  validate,
  ctrl.generateQuiz
);

router.post(
  '/format-lesson',
  [body('text').isString().withMessage('text is required')],
  validate,
  ctrl.formatLesson
);

module.exports = router;
