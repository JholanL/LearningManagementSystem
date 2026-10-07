const mongoose = require('mongoose');

// Issued automatically when an agent completes every lesson and passes every quiz of a course.
// Anyone can verify a certificate code through the public verify endpoint.
const certificateSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    code: { type: String, required: true, unique: true }, // e.g. VLA-2026-7F3K9Q
    finalScore: { type: Number, required: true }, // average best quiz %
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

certificateSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Certificate', certificateSchema);
