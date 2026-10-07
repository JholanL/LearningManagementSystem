const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');
const { generateToken } = require('../utils/token');

// POST /api/auth/register  (public) - self-registration is always an AGENT account
exports.register = asyncHandler(async (req, res) => {
  const data = pick(req.body, ['firstName', 'lastName', 'email', 'password', 'employeeId', 'phone']);
  if (await User.exists({ email: data.email })) throw new ApiError(409, 'Email is already registered.');

  const user = await User.create({ ...data, role: 'agent' });
  res.status(201).json({ success: true, message: 'Account created.', token: generateToken(user), user });
});

// POST /api/auth/login  (public)
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password +tokenVersion +failedLoginAttempts +lockUntil');

  // Same message for "no user" and "wrong password" so attackers can't discover valid emails
  const invalid = new ApiError(401, 'Invalid email or password.');
  if (!user) throw invalid;

  if (user.isLocked) {
    const minutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new ApiError(423, `Account locked due to too many failed attempts. Try again in ${minutes} minute(s).`);
  }

  if (!(await user.comparePassword(password))) {
    await user.registerFailedLogin();
    throw invalid;
  }

  if (!user.isActive) throw new ApiError(403, 'Your account has been deactivated. Contact your administrator.');

  await user.registerSuccessfulLogin();
  await user.populate('batch', 'name account');
  res.json({ success: true, message: 'Logged in.', token: generateToken(user), user });
});

// GET /api/auth/me
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('batch', 'name account startDate endDate status');
  res.json({ success: true, user });
});

// PUT /api/auth/me  - update own profile (role/email/batch cannot be changed here)
exports.updateMe = asyncHandler(async (req, res) => {
  const updates = pick(req.body, ['firstName', 'lastName', 'phone', 'avatarUrl']);
  const user = await User.findById(req.user._id);
  Object.assign(user, updates);
  await user.save();
  await user.populate('batch', 'name account');
  res.json({ success: true, message: 'Profile updated.', user });
});

// PUT /api/auth/me/password  - change password, logs out all other sessions
exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password +tokenVersion');
  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect.');
  }
  user.password = req.body.newPassword;
  user.tokenVersion += 1;
  await user.save();
  res.json({ success: true, message: 'Password changed.', token: generateToken(user) });
});

// POST /api/auth/logout  - invalidates every token issued to this user
exports.logout = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  res.json({ success: true, message: 'Logged out.' });
});
