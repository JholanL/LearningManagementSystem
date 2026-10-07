const Certificate = require('../models/Certificate');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { paginate, escapeRegex } = require('../utils/query');

// GET /api/certificates/me   (agent)
exports.getMyCertificates = asyncHandler(async (req, res) => {
  const data = await Certificate.find({ user: req.user._id }).populate('course', 'code title category').sort('-issuedAt');
  res.json({ success: true, data });
});

// GET /api/certificates?search=&page=&limit=   (admin, trainer) - search by agent name or code
exports.getCertificates = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    const users = await User.find({ $or: [{ firstName: regex }, { lastName: regex }] }).select('_id');
    filter.$or = [{ code: regex }, { user: { $in: users.map((u) => u._id) } }];
  }
  const result = await paginate(Certificate, filter, req.query, {
    sort: '-issuedAt',
    populate: [
      { path: 'user', select: 'firstName lastName employeeId' },
      { path: 'course', select: 'code title' },
    ],
  });
  res.json({ success: true, ...result });
});

// GET /api/certificates/verify/:code   (PUBLIC) - anyone can check if a certificate is real
// Only returns non-sensitive info (no email, no ids).
exports.verifyCertificate = asyncHandler(async (req, res) => {
  const code = String(req.params.code).toUpperCase().trim();
  if (!/^VLA-\d{4}-[A-F0-9]{6}$/.test(code)) throw new ApiError(400, 'Invalid certificate code format.');

  const cert = await Certificate.findOne({ code })
    .populate('user', 'firstName lastName')
    .populate('course', 'code title');
  if (!cert || !cert.user || !cert.course) {
    return res.status(404).json({ success: false, valid: false, message: 'Certificate not found.' });
  }
  res.json({
    success: true,
    valid: true,
    data: {
      code: cert.code,
      holder: `${cert.user.firstName} ${cert.user.lastName}`,
      course: `${cert.course.code} - ${cert.course.title}`,
      finalScore: cert.finalScore,
      issuedAt: cert.issuedAt,
    },
  });
});
