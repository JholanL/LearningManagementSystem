const router = require('express').Router();
const ctrl = require('../controllers/evaluationController');
const v = require('../validators/evaluationValidators');
const validate = require('../middleware/validate');
const { mongoIdParam } = require('../validators/common');
const { protect, authorize } = require('../middleware/auth');

const staff = authorize('admin', 'trainer');

router.use(protect);

router.get('/criteria', ctrl.getCriteria);
router.route('/').get(ctrl.getEvaluations).post(staff, v.createEvaluation, validate, ctrl.createEvaluation);
router
  .route('/:id')
  .get(mongoIdParam(), validate, ctrl.getEvaluation)
  .put(staff, mongoIdParam(), v.updateEvaluation, validate, ctrl.updateEvaluation)
  .delete(staff, mongoIdParam(), validate, ctrl.deleteEvaluation);
router.patch('/:id/acknowledge', authorize('agent'), mongoIdParam(), v.acknowledge, validate, ctrl.acknowledge);

module.exports = router;
