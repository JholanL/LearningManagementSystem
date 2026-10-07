const router = require('express').Router();
const ctrl = require('../controllers/userController');
const v = require('../validators/userValidators');
const validate = require('../middleware/validate');
const { mongoIdParam } = require('../validators/common');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

router.route('/').get(ctrl.getUsers).post(v.createUser, validate, ctrl.createUser);
router
  .route('/:id')
  .get(mongoIdParam(), validate, ctrl.getUser)
  .put(mongoIdParam(), v.updateUser, validate, ctrl.updateUser)
  .delete(mongoIdParam(), validate, ctrl.deleteUser);
router.patch('/:id/status', mongoIdParam(), validate, ctrl.toggleStatus);
router.patch('/:id/unlock', mongoIdParam(), validate, ctrl.unlockUser);

module.exports = router;
