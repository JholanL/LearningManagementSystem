const mongoose = require('mongoose');

// An append-only record of security-relevant actions (who did what, when).
// actorName/actorRole are snapshots so the log stays readable even after the
// user is deleted. metadata must stay small and NEVER contain passwords/tokens.
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = unknown (e.g. failed login, bad email)
    actorName: { type: String, default: 'Unknown' },
    actorRole: { type: String, default: 'guest' },
    action: { type: String, required: true, index: true }, // e.g. auth.login, user.delete, course.publish
    targetType: { type: String },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    targetLabel: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true } // createdAt is the event time
);

auditLogSchema.index({ createdAt: -1 });
// Optional retention: drop entries older than 180 days.
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
