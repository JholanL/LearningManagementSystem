const router = require('express').Router();
const ctrl = require('../controllers/drillController');
const v = require('../validators/drillValidators');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('agent'));

router.get('/today', ctrl.getToday);
router.post('/submit', v.submit, validate, ctrl.submit);
router.get('/history', ctrl.history);

module.exports = router;
