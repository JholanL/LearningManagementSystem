const User = require('../models/User');
const generateToken = require('../utils/generateToken');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PUBLIC_ROLES = ['student', 'instructor'];

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const sendAuth = (res, status, user) =>
  res.status(status).json({
    token: generateToken(user._id),
    user: formatUser(user),
  });

exports.register = async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (![name, email, password].every((v) => typeof v === 'string' && v.trim())) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  const userRole = role === undefined ? 'student' : role;
  if (!PUBLIC_ROLES.includes(userRole)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  try {
    const user = await User.create({ name, email, password, role: userRole });
    return sendAuth(res, 201, user);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email is already registered' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    throw err;
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  return sendAuth(res, 200, user);
};

exports.getMe = (req, res) => {
  res.json({ user: formatUser(req.user) });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ message: 'Current and new password are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }

  const user = await User.findById(req.user._id).select('+password');

  // 400, not 401: the client logs people out on 401, and they are still signed in.
  if (!(await user.comparePassword(currentPassword))) {
    return res.status(400).json({ message: 'Current password is incorrect' });
  }

  user.password = newPassword;
  await user.save();

  res.json({ message: 'Password updated' });
};

exports.updateMe = async (req, res) => {
  const { name } = req.body || {};

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'Name is required' });
  }
  if (name.trim().length > 100) {
    return res.status(400).json({ message: 'Name must be at most 100 characters' });
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name: name.trim() },
    { returnDocument: 'after', runValidators: true }
  );

  res.json({ user: formatUser(user) });
};