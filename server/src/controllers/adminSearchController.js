const User = require('../models/User');
const Batch = require('../models/Batch');
const Course = require('../models/Course');
const Certificate = require('../models/Certificate');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { escapeRegex } = require('../utils/query');

const RESULT_LIMIT = 5;

const cleanQuery = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const userSearchFilter = (regex) => ({
  $or: [
    { firstName: regex },
    { lastName: regex },
    { email: regex },
    { employeeId: regex },
    { $expr: { $regexMatch: { input: { $concat: ['$firstName', ' ', '$lastName'] }, regex: regex.source, options: 'i' } } },
  ],
});

const toUserResult = (user) => ({
  id: String(user._id),
  name: `${user.firstName} ${user.lastName}`.trim(),
  email: user.email,
  employeeId: user.employeeId || null,
  role: user.role,
  isActive: user.isActive,
});

const toCertificateResult = (certificate) => ({
  id: String(certificate._id),
  code: certificate.code,
  finalScore: certificate.finalScore,
  issuedAt: certificate.issuedAt,
  agent: certificate.user
    ? {
        name: `${certificate.user.firstName || ''} ${certificate.user.lastName || ''}`.trim(),
        employeeId: certificate.user.employeeId || null,
      }
    : null,
  course: certificate.course
    ? { code: certificate.course.code || null, title: certificate.course.title || null }
    : null,
});

const searchAdminRecords = asyncHandler(async (req, res) => {
  const query = cleanQuery(req.query.q);
  if (query.length < 2) throw new ApiError(422, 'Search query must contain at least 2 characters.');
  if (query.length > 100) throw new ApiError(422, 'Search query is too long.');

  const regex = new RegExp(escapeRegex(query), 'i');
  const userFilter = userSearchFilter(regex);
  const [users, batches, matchingUsers, matchingCourses] = await Promise.all([
    User.find(userFilter)
      .select('firstName lastName email employeeId role isActive')
      .sort({ lastName: 1, firstName: 1, _id: 1 })
      .limit(RESULT_LIMIT)
      .lean(),
    Batch.find({ $or: [{ name: regex }, { account: regex }] })
      .select('name account status')
      .sort({ name: 1, _id: 1 })
      .limit(RESULT_LIMIT)
      .lean(),
    User.find({ role: 'agent', ...userFilter }).select('_id').limit(RESULT_LIMIT).lean(),
    Course.find({ $or: [{ title: regex }, { code: regex }] }).select('_id').limit(RESULT_LIMIT).lean(),
  ]);

  const certificateOr = [{ code: regex }];
  if (matchingUsers.length) certificateOr.push({ user: { $in: matchingUsers.map((user) => user._id) } });
  if (matchingCourses.length) certificateOr.push({ course: { $in: matchingCourses.map((course) => course._id) } });

  const certificates = await Certificate.find({ $or: certificateOr })
    .select('code finalScore issuedAt user course')
    .populate('user', 'firstName lastName employeeId')
    .populate('course', 'code title')
    .sort({ issuedAt: -1, _id: 1 })
    .limit(RESULT_LIMIT)
    .lean();

  res.json({
    success: true,
    data: {
      query,
      limit: RESULT_LIMIT,
      users: users.map(toUserResult),
      batches: batches.map((batch) => ({
        id: String(batch._id),
        name: batch.name,
        account: batch.account,
        status: batch.status,
      })),
      certificates: certificates.map(toCertificateResult),
    },
  });
});

module.exports = { searchAdminRecords };
