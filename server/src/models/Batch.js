const mongoose = require('mongoose');

// A "wave" / training batch of new-hire agents handled by one trainer.
// The courses array is the batch's curriculum: agents in this batch
// see these courses on their dashboard.
const batchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 60 }, // e.g. "Wave 12"
    account: { type: String, required: true, trim: true, maxlength: 100 }, // e.g. "Lumina Telecom - Postpaid Support"
    description: { type: String, trim: true, maxlength: 500 },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['upcoming', 'ongoing', 'completed'], default: 'upcoming' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Batch', batchSchema);
