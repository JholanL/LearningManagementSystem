const { query } = require('express-validator');

// GET /api/notifications query filters
const listNotifications = [query('unread').optional().isBoolean().withMessage('unread must be true or false')];

module.exports = { listNotifications };
