/* eslint-disable no-console */
const Notification = require('../models/Notification');

/**
 * Create one notification for each recipient. MUST NEVER THROW.
 * @param {string|ObjectId|Array} userIds  one id or a list of recipient ids
 * @param {{ type, title, message, link }} payload
 */
async function notify(userIds, { type, title, message, link } = {}) {
  try {
    const ids = (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean);
    if (!ids.length) return;
    // de-dupe recipients so nobody gets the same notification twice
    const unique = [...new Set(ids.map(String))];
    await Notification.insertMany(
      unique.map((user) => ({ user, type, title, message, link })),
      { ordered: false }
    );
  } catch (err) {
    console.error('[notify] failed to create notifications:', err.message);
  }
}

module.exports = { notify };
