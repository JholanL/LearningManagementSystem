const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    answers: [{ type: Number }], // selected option index per question (-1 = unanswered)
    // Per-question breakdown for analytics (survives question reordering); `answers` kept for compatibility.
    answerDetails: {
      type: [
        {
          _id: false,
          questionId: { type: mongoose.Schema.Types.ObjectId },
          selected: { type: Number },
          correct: { type: Boolean },
        },
      ],
      default: undefined,
    },
    score: { type: Number, required: true },
    totalPoints: { type: Number, required: true },
    percentage: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    attemptNumber: { type: Number, required: true },
    timeTakenSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
