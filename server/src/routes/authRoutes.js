const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/authController');
const v = require('../validators/authValidators');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');

// Stricter limit on login/register to slow down brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
});

router.post('/register', authLimiter, v.register, validate, ctrl.register);
router.post('/login', authLimiter, v.login, validate, ctrl.login);

router.use(protect);
router.get('/me', ctrl.getMe);
router.put('/me', v.updateMe, validate, ctrl.updateMe);
router.put('/me/password', v.changePassword, validate, ctrl.changePassword);
router.post('/logout', ctrl.logout);

module.exports = router;
