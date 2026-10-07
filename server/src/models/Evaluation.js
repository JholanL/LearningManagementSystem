const mongoose = require('mongoose');

// QA Scorecard: a trainer evaluates an agent's mock call.
// Each criterion is rated 1-5 and weighted; overallScore is a percentage.
const CRITERIA = {
  greeting: { label: 'Opening & Greeting', weight: 10 },
  empathy: { label: 'Empathy & Rapport', weight: 20 },
  productKnowledge: { label: 'Product Knowledge', weight: 20 },
  resolution: { label: 'Problem Resolution', weight: 25 },
  compliance: { label: 'Compliance & Verification', weight: 15 },
  closing: { label: 'Call Closing', weight: 10 },
};

const scoreField = { type: Number, required: true, min: 1, max: 5 };

const evaluationSchema = new mongoose.Schema(
  {
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    evaluator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    callType: { type: String, enum: ['Inbound', 'Outbound', 'Chat', 'Email'], default: 'Inbound' },
    callSummary: { type: String, required: true, trim: true, maxlength: 1000 },
    scores: {
      greeting: scoreField,
      empathy: scoreField,
      productKnowledge: scoreField,
      resolution: scoreField,
      compliance: scoreField,
      closing: scoreField,
    },
    overallScore: { type: Number }, // computed, 0-100
    rating: { type: String }, // computed label
    strengths: { type: String, trim: true, maxlength: 1000 },
    areasForImprovement: { type: String, trim: true, maxlength: 1000 },
    coachingPlan: { type: String, trim: true, maxlength: 1000 },
    // Agent acknowledges the coaching (common BPO practice)
    acknowledged: { type: Boolean, default: false },
    acknowledgedAt: { type: Date },
    agentComment: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

evaluationSchema.pre('save', function () {
  let total = 0;
  Object.entries(CRITERIA).forEach(([key, { weight }]) => {
    total += (this.scores[key] / 5) * weight;
  });
  this.overallScore = Math.round(total);
  if (this.overallScore >= 90) this.rating = 'Exceeds Expectations';
  else if (this.overallScore >= 80) this.rating = 'Meets Expectations';
  else if (this.overallScore >= 70) this.rating = 'Needs Improvement';
  else this.rating = 'Unsatisfactory';
});

module.exports = mongoose.model('Evaluation', evaluationSchema);
module.exports.CRITERIA = CRITERIA;
