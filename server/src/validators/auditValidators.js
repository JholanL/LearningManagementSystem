const { query } = require('express-validator');

// GET /api/audit-logs query filters
const listAuditLogs = [
  query('action').optional().isString().trim().isLength({ max: 60 }),
  query('actor').optional().isMongoId().withMessage('Invalid actor id'),
  query('from').optional().isISO8601().withMessage('from must be a date (YYYY-MM-DD)'),
  query('to').optional().isISO8601().withMessage('to must be a date (YYYY-MM-DD)'),
];

module.exports = { listAuditLogs };
