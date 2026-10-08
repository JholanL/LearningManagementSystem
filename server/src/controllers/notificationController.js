const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { paginate } = require('../utils/query');

// GET /api/notifications?unread=true&page=&limit=   - OWN notifications only
exports.getNotifications = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.unread === 'true') filter.read = false;

  const result = await paginate(Notification, filter, req.query);
  const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json({ success: true, ...result, unreadCount });
});

// GET /api/notifications/unread-count   -> { count }
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json({ success: true, count });
});

// PATCH /api/notifications/:id/read   (owner only)
exports.markRead = asyncHandler(async (req, res) => {
  // Scoping the query to the owner means someone else's id simply isn't found -> 404.
  const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!notification) throw new ApiError(404, 'Notification not found');
  if (!notification.read) {
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();
  }
  res.json({ success: true, message: 'Marked as read.', data: notification });
});

// PATCH /api/notifications/read-all
exports.markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { user: req.user._id, read: false },
    { $set: { read: true, readAt: new Date() } }
  );
  res.json({ success: true, message: 'All notifications marked as read.', modified: result.modifiedCount });
});

// DELETE /api/notifications/:id   (owner only)
exports.remove = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!notification) throw new ApiError(404, 'Notification not found');
  res.json({ success: true, message: 'Notification deleted.' });
});
