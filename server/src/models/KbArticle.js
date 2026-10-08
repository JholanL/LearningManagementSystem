const mongoose = require('mongoose');

const CATEGORIES = ['Product', 'Billing', 'Technical', 'Process', 'Compliance', 'Scripts'];

// A searchable knowledge-base article (product info, scripts, troubleshooting guides).
// Body is plain text / markdown and is rendered with line breaks only (never as HTML).
const kbArticleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    category: { type: String, enum: CATEGORIES, required: true },
    tags: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
      validate: [(v) => !v || v.length <= 10, 'A maximum of 10 tags'],
    },
    summary: { type: String, trim: true, maxlength: 300 },
    body: { type: String, required: true, maxlength: 20000 },
    account: { type: String, trim: true, maxlength: 100 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    views: { type: Number, default: 0 },
    relatedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('KbArticle', kbArticleSchema);
module.exports.CATEGORIES = CATEGORIES;
