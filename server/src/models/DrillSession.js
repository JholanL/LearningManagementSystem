const mongoose = require('mongoose');

// One daily-drill session per agent per day (Asia/Manila). Practice only:
// it never touches QuizAttempt, Progress or certificates.
const drillSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD' in Asia/Manila
    questions: [
      {
        _id: false,
        quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
        questionId: { type: mongoose.Schema.Types.ObjectId },
      },
    ],
    answers: [{ type: Number }], // selected option index per question
    score: { type: Number },
    total: { type: Number },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

drillSessionSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DrillSession', drillSessionSchema);
