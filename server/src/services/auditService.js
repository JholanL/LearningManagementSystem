/* eslint-disable no-console */
const AuditLog = require('../models/AuditLog');

// Defensive: strip anything that looks like a secret, even if a caller passes it by mistake.
const SENSITIVE = /pass|token|secret|otp|authorization|cookie/i;
function sanitize(metadata) {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const clean = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE.test(key)) continue; // never store passwords or tokens
    clean[key] = value && typeof value === 'object' && !Array.isArray(value) ? sanitize(value) : value;
  }
  return clean;
}

/**
 * Write one audit entry. MUST NEVER THROW and must not break the request.
 * Usage: await audit(req, { action: 'user.delete', targetType: 'User', targetId, targetLabel, metadata });
 * For actions where req.user is not set yet (login), pass actor/actorName/actorRole explicitly.
 */
async function audit(req = {}, { action, actor, actorName, actorRole, targetType, targetId, targetLabel, metadata } = {}) {
  try {
    const u = req.user;
    await AuditLog.create({
      actor: actor !== undefined ? actor : u?._id || null,
      actorName: actorName || (u ? `${u.firstName} ${u.lastName}` : 'Unknown'),
      actorRole: actorRole || u?.role || 'guest',
      action,
      targetType,
      targetId,
      targetLabel,
      metadata: sanitize(metadata),
      ip: req.ip,
      userAgent: (req.headers?.['user-agent'] || '').slice(0, 300),
    });
  } catch (err) {
    // Logging must never take down the request it describes.
    console.error('[audit] failed to write entry:', err.message);
  }
}

module.exports = { audit };
