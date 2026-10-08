const mongoose = require('mongoose');

// One "was this helpful?" vote per user per article. The unique index lets a
// user change their vote (upsert) instead of adding a second one.
const kbFeedbackSchema = new mongoose.Schema(
  {
    article: { type: mongoose.Schema.Types.ObjectId, ref: 'KbArticle', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    helpful: { type: Boolean, required: true },
  },
  { timestamps: true }
);

kbFeedbackSchema.index({ article: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('KbFeedback', kbFeedbackSchema);
