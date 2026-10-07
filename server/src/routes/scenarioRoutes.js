const router = require('express').Router();
const ctrl = require('../controllers/scenarioController');
const v = require('../validators/scenarioValidators');
const validate = require('../middleware/validate');
const { mongoIdParam } = require('../validators/common');
const { protect, authorize } = require('../middleware/auth');

const staff = authorize('admin', 'trainer');

router.use(protect);

router.route('/').get(ctrl.getScenarios).post(staff, v.createScenario, validate, ctrl.createScenario);
router
  .route('/:id')
  .get(mongoIdParam(), validate, ctrl.getScenario)
  .put(staff, mongoIdParam(), v.updateScenario, validate, ctrl.updateScenario)
  .delete(staff, mongoIdParam(), validate, ctrl.deleteScenario);
router.patch('/:id/publish', staff, mongoIdParam(), validate, ctrl.togglePublish);
router.post('/:id/respond', authorize('agent'), mongoIdParam(), v.respond, validate, ctrl.respond);
router.post('/:id/submit', authorize('agent'), mongoIdParam(), v.submit, validate, ctrl.submit);
router.get('/:id/attempts', mongoIdParam(), validate, ctrl.getAttempts);

module.exports = router;
