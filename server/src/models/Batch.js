const mongoose = require('mongoose');

// A "wave" / training batch of new-hire agents handled by one trainer.
// The courses array is the batch's curriculum: agents in this batch
// see these courses on their dashboard.
const batchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 60 }, // e.g. "Wave 12"
    account: { type: String, required: true, trim: true, maxlength: 100 }, // e.g. "Lumina Telecom - Postpaid Support"
    description: { type: String, trim: true, maxlength: 500 },
    // Call Simulator channel for this account: voice (call only), non_voice (text/chat only), or blended (both).
    channel: { type: String, enum: ['voice', 'non_voice', 'blended'], default: 'blended' },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    // Optimistic concurrency token for complete membership replacements.
    membershipVersion: { type: Number, default: 0, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['upcoming', 'ongoing', 'completed'], default: 'upcoming' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Batch', batchSchema);
