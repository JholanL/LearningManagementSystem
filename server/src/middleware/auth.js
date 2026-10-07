const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Verifies the JWT in "Authorization: Bearer <token>" and attaches req.user
const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Not authorized. Please log in.');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid token.';
    throw new ApiError(401, msg);
  }

  const user = await User.findById(decoded.id).select('+tokenVersion');
  if (!user) throw new ApiError(401, 'User no longer exists.');
  if (!user.isActive) throw new ApiError(403, 'Your account has been deactivated. Contact your administrator.');
  // Token was issued before a logout / password change -> reject it
  if (decoded.tv !== user.tokenVersion) throw new ApiError(401, 'Session ended. Please log in again.');

  req.user = user;
  next();
});

// Role-based access control: authorize('admin', 'trainer')
const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action.'));
    }
    next();
  };

module.exports = { protect, authorize };
