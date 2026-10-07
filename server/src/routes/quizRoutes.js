const router = require('express').Router();
const ctrl = require('../controllers/quizController');
const v = require('../validators/quizValidators');
const validate = require('../middleware/validate');
const { mongoIdParam } = require('../validators/common');
const { protect, authorize } = require('../middleware/auth');

const staff = authorize('admin', 'trainer');

router.use(protect);

router
  .route('/:id')
  .get(mongoIdParam(), validate, ctrl.getQuiz)
  .put(staff, mongoIdParam(), v.updateQuiz, validate, ctrl.updateQuiz)
  .delete(staff, mongoIdParam(), validate, ctrl.deleteQuiz);
router.post('/:id/submit', authorize('agent'), mongoIdParam(), v.submitQuiz, validate, ctrl.submitQuiz);
router.get('/:id/attempts', mongoIdParam(), validate, ctrl.getAttempts);

module.exports = router;
