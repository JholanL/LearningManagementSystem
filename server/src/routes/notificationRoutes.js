const router = require('express').Router();
const ctrl = require('../controllers/notificationController');
const v = require('../validators/notificationValidators');
const validate = require('../middleware/validate');
const { mongoIdParam } = require('../validators/common');
const { protect } = require('../middleware/auth');

router.use(protect); // any logged-in user; ownership is enforced per-record in the controller

router.get('/', v.listNotifications, validate, ctrl.getNotifications);
router.get('/unread-count', ctrl.getUnreadCount);
router.patch('/read-all', ctrl.markAllRead);
router.patch('/:id/read', mongoIdParam(), validate, ctrl.markRead);
router.delete('/:id', mongoIdParam(), validate, ctrl.remove);

module.exports = router;
