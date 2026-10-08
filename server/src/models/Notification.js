const mongoose = require('mongoose');

const TYPES = [
  'evaluation.new',
  'quiz.result',
  'agent.at_risk',
  'batch.assigned',
  'course.published',
  'endorsement.requested',
  'endorsement.decided',
  'drill.streak',
];

// An in-app notification for one user. Surfaced by the topbar bell.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 300 },
    link: { type: String, trim: true }, // frontend path, e.g. /agent/evaluations
    read: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
// Optional retention: drop notifications older than 90 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.TYPES = TYPES;
