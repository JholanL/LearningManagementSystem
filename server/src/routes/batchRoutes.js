const router = require('express').Router();
const ctrl = require('../controllers/batchController');
const v = require('../validators/batchValidators');
const validate = require('../middleware/validate');
const { mongoIdParam } = require('../validators/common');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router
  .route('/')
  .get(authorize('admin', 'trainer'), ctrl.getBatches)
  .post(authorize('admin'), v.createBatch, validate, ctrl.createBatch);
router
  .route('/:id')
  .get(authorize('admin', 'trainer'), mongoIdParam(), validate, ctrl.getBatch)
  .put(authorize('admin'), mongoIdParam(), v.updateBatch, validate, ctrl.updateBatch)
  .delete(authorize('admin'), mongoIdParam(), validate, ctrl.deleteBatch);
router.put('/:id/agents', authorize('admin'), mongoIdParam(), v.setAgents, validate, ctrl.setAgents);

module.exports = router;
