const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true, maxlength: 1000 },
  options: {
    type: [{ type: String, trim: true, maxlength: 500 }],
    validate: [(v) => v.length >= 2 && v.length <= 6, 'A question needs 2 to 6 options'],
  },
  correctAnswer: { type: Number, required: true, min: 0 }, // index of the correct option
  explanation: { type: String, trim: true, maxlength: 1000 }, // shown after submitting
  points: { type: Number, default: 1, min: 1 },
});

const quizSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 1000 },
    timeLimitMinutes: { type: Number, default: 0, min: 0 }, // 0 = no time limit
    questions: {
      type: [questionSchema],
      validate: [(v) => v.length >= 1, 'A quiz needs at least one question'],
    },
  },
  { timestamps: true }
);

quizSchema.virtual('totalPoints').get(function () {
  return (this.questions || []).reduce((sum, q) => sum + (q.points || 1), 0);
});

// Version that is safe to send to agents (no correct answers / explanations)
quizSchema.methods.toAgentView = function () {
  return {
    _id: this._id,
    course: this.course,
    title: this.title,
    description: this.description,
    timeLimitMinutes: this.timeLimitMinutes,
    totalPoints: this.totalPoints,
    questions: this.questions.map((q) => ({
      _id: q._id,
      question: q.question,
      options: q.options,
      points: q.points,
    })),
  };
};

module.exports = mongoose.model('Quiz', quizSchema);
