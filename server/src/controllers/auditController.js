const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');
const { paginate, searchFilter } = require('../utils/query');

// GET /api/audit-logs?search=&action=&actor=&from=&to=&page=&limit=   (admin)
// search matches actorName, targetLabel and action; newest first.
exports.getAuditLogs = asyncHandler(async (req, res) => {
  const { search, action, actor, from, to } = req.query;
  const filter = { ...searchFilter(search, ['actorName', 'targetLabel', 'action']) };
  if (action) filter.action = action;
  if (actor) filter.actor = actor;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) {
      // make "to" inclusive of the whole day
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const result = await paginate(AuditLog, filter, req.query, { sort: '-createdAt' });
  res.json({ success: true, ...result });
});

// GET /api/audit-logs/actions   (admin) - distinct action names for the filter dropdown
exports.getActions = asyncHandler(async (_req, res) => {
  const actions = await AuditLog.distinct('action');
  res.json({ success: true, data: actions.sort() });
});
