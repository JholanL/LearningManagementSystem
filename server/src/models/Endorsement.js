const mongoose = require('mongoose');

// A trainer's request to put an agent into production, approved by an admin (feature 5).
const snapshotSchema = new mongoose.Schema(
  {
    overallPercent: Number,
    averageQuizScore: Number,
    averageSimulatorScore: Number,
    averageEvaluationScore: Number,
    readinessScore: Number,
    coursesCompleted: Number,
    totalCourses: Number,
  },
  { _id: false }
);

const endorsementSchema = new mongoose.Schema(
  {
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'revoked'], default: 'pending', index: true },
    trainerNote: { type: String, trim: true, maxlength: 1000 },
    decisionNote: { type: String, trim: true, maxlength: 1000 },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
    snapshot: snapshotSchema, // metrics frozen at request time
  },
  { timestamps: true }
);

// At most one PENDING endorsement per agent (partial unique index).
endorsementSchema.index({ agent: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });

module.exports = mongoose.model('Endorsement', endorsementSchema);
