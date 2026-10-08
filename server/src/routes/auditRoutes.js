const router = require('express').Router();
const ctrl = require('../controllers/auditController');
const v = require('../validators/auditValidators');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/', v.listAuditLogs, validate, ctrl.getAuditLogs);
router.get('/actions', ctrl.getActions);

module.exports = router;
