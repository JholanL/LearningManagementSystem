const router = require('express').Router();
const ctrl = require('../controllers/kbController');
const v = require('../validators/kbValidators');
const validate = require('../middleware/validate');
const { mongoIdParam } = require('../validators/common');
const { protect, authorize } = require('../middleware/auth');

const staff = authorize('admin', 'trainer');

router.use(protect);

router.get('/', ctrl.getArticles);
router.get('/popular', ctrl.getPopular); // must be before '/:slug'
router.post('/', staff, v.createArticle, validate, ctrl.createArticle);

router.get('/:slug', v.slugParam, validate, ctrl.getArticle);

router.put('/:id', staff, mongoIdParam(), v.updateArticle, validate, ctrl.updateArticle);
router.patch('/:id/publish', staff, mongoIdParam(), validate, ctrl.togglePublish);
router.delete('/:id', authorize('admin'), mongoIdParam(), validate, ctrl.deleteArticle);
router.post('/:id/feedback', mongoIdParam(), v.feedback, validate, ctrl.feedback);

module.exports = router;
