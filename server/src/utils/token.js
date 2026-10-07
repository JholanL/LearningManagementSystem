const jwt = require('jsonwebtoken');

// tokenVersion lets us invalidate every issued token for a user
// (logout from all devices, password change, deactivation).
const generateToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, tv: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );

module.exports = { generateToken };
