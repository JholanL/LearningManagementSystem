const router = require('express').Router();
const ctrl = require('../controllers/analyticsController');
const validate = require('../middleware/validate');
const { mongoIdParam } = require('../validators/common');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin', 'trainer')); // agents are never allowed (403)

router.get('/quiz/:quizId', mongoIdParam('quizId'), validate, ctrl.quizAnalytics);
router.get('/course/:courseId', mongoIdParam('courseId'), validate, ctrl.courseAnalytics);
router.get('/agent/:agentId', mongoIdParam('agentId'), validate, ctrl.agentAnalytics);

module.exports = router;
