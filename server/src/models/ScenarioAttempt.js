const mongoose = require('mongoose');

const scenarioAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    scenario: { type: mongoose.Schema.Types.ObjectId, ref: 'Scenario', required: true, index: true },
    path: [
      {
        _id: false,
        stepKey: String,
        optionIndex: Number,
        score: Number,
      },
    ],
    totalScore: { type: Number, required: true },
    maxScore: { type: Number, required: true },
    percentage: { type: Number, required: true },
    passed: { type: Boolean, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ScenarioAttempt', scenarioAttemptSchema);
