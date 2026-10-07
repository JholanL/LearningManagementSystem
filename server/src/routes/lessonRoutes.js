const router = require('express').Router();
const ctrl = require('../controllers/lessonController');
const v = require('../validators/courseValidators');
const validate = require('../middleware/validate');
const { mongoIdParam } = require('../validators/common');
const { protect, authorize } = require('../middleware/auth');

const staff = authorize('admin', 'trainer');

router.use(protect);

router
  .route('/:id')
  .get(mongoIdParam(), validate, ctrl.getLesson)
  .put(staff, mongoIdParam(), v.updateLesson, validate, ctrl.updateLesson)
  .delete(staff, mongoIdParam(), validate, ctrl.deleteLesson);
router.post('/:id/complete', authorize('agent'), mongoIdParam(), validate, ctrl.completeLesson);

module.exports = router;
