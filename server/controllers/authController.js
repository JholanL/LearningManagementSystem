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