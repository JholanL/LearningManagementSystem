const mongoose = require('mongoose');

// Call Simulator: a branching conversation.
// Each step has what the customer says + response options for the agent.
// Each option has a score (0-10), feedback, and the key of the next step (null = call ends).
const optionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 500 },
    score: { type: Number, required: true, min: 0, max: 10 },
    feedback: { type: String, trim: true, maxlength: 500 },
    nextStep: { type: String, default: null }, // step key, or null to end the call
  },
  { _id: false }
);

const stepSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true }, // e.g. "greeting", "verify", "resolve"
    customerLine: { type: String, required: true, trim: true, maxlength: 1000 },
    options: {
      type: [optionSchema],
      validate: [(v) => v.length >= 2 && v.length <= 4, 'A step needs 2 to 4 options'],
    },
  },
  { _id: false }
);

const scenarioSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 1000 },
    category: { type: String, enum: ['Billing', 'Technical', 'Sales', 'Complaint', 'Account'], required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Easy' },
    customer: {
      name: { type: String, required: true, trim: true },
      mood: { type: String, enum: ['calm', 'confused', 'frustrated', 'irate'], default: 'calm' },
      issue: { type: String, required: true, trim: true, maxlength: 500 },
    },
    startStep: { type: String, required: true },
    steps: { type: [stepSchema], validate: [(v) => v.length >= 1, 'A scenario needs at least one step'] },
    passingScore: { type: Number, default: 70, min: 1, max: 100 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Make sure every nextStep / startStep points to a real step key
scenarioSchema.pre('validate', function () {
  const keys = new Set(this.steps.map((s) => s.key));
  if (keys.size !== this.steps.length) this.invalidate('steps', 'Step keys must be unique');
  if (!keys.has(this.startStep)) this.invalidate('startStep', 'startStep must match a step key');
  this.steps.forEach((s) =>
    s.options.forEach((o) => {
      if (o.nextStep && !keys.has(o.nextStep)) {
        this.invalidate('steps', `Option "${o.text}" points to missing step "${o.nextStep}"`);
      }
    })
  );
});

scenarioSchema.methods.getStep = function (key) {
  return this.steps.find((s) => s.key === key);
};

// Step without scores/feedback (safe for agents while playing)
scenarioSchema.methods.publicStep = function (key) {
  const step = this.getStep(key);
  if (!step) return null;
  return {
    key: step.key,
    customerLine: step.customerLine,
    options: step.options.map((o, index) => ({ index, text: o.text })),
  };
};

module.exports = mongoose.model('Scenario', scenarioSchema);
