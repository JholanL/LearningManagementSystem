const mongoose = require('mongoose');

// One line of a voice-mode call recording (text transcript only; no audio is stored).
const transcriptEntrySchema = new mongoose.Schema(
  {
    speaker: { type: String, enum: ['customer', 'agent'], required: true },
    text: { type: String, trim: true, maxlength: 1000 },
    stepKey: { type: String },
    offsetMs: { type: Number, min: 0 },
    durationMs: { type: Number, min: 0 },
  },
  { _id: false }
);

// Server-computed delivery metrics (voice mode only).
const deliverySchema = new mongoose.Schema(
  {
    deadAirMs: Number,
    longestSilenceMs: Number,
    deadAirCount: Number,
    fillerCount: Number,
    fillers: { type: Map, of: Number },
    wordsPerMinute: Number,
    talkTimeMs: Number,
    totalDurationMs: Number,
    deliveryScore: Number,
  },
  { _id: false }
);

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
    percentage: { type: Number, required: true }, // content score (what they said)
    passed: { type: Boolean, required: true },

    // ----- Voice mode (feature 1). All optional, so old text attempts stay valid. -----
    mode: { type: String, enum: ['text', 'voice'], default: 'text' },
    transcript: { type: [transcriptEntrySchema], default: undefined, validate: [(v) => !v || v.length <= 60, 'Transcript is too long'] },
    delivery: { type: deliverySchema, default: undefined }, // only for voice
    combinedScore: { type: Number }, // voice: round(content*0.7 + delivery*0.3); text: = percentage
  },
  { timestamps: true }
);

module.exports = mongoose.model('ScenarioAttempt', scenarioAttemptSchema);
