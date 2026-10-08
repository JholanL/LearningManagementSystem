const router = require('express').Router();
const ctrl = require('../controllers/endorsementController');
const v = require('../validators/endorsementValidators');
const validate = require('../middleware/validate');
const { mongoIdParam } = require('../validators/common');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/eligibility/:agentId', authorize('admin', 'trainer'), mongoIdParam('agentId'), validate, ctrl.getEligibility);
router.post('/', authorize('trainer'), v.create, validate, ctrl.createEndorsement);
router.get('/', ctrl.getEndorsements); // all roles, scoped in the controller

router.patch('/:id/approve', authorize('admin'), mongoIdParam(), v.decision, validate, ctrl.approve);
router.patch('/:id/reject', authorize('admin'), mongoIdParam(), v.reject, validate, ctrl.reject);
router.patch('/:id/revoke', authorize('admin'), mongoIdParam(), v.decision, validate, ctrl.revoke);

module.exports = router;
