const mongoose = require('mongoose');

const CATEGORIES = ['Soft Skills', 'Product Knowledge', 'Systems & Tools', 'Compliance', 'Process'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

const courseSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 20 }, // e.g. CSF-101
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: CATEGORIES, required: true },
    level: { type: String, enum: LEVELS, default: 'Beginner' },
    passingScore: { type: Number, default: 85, min: 1, max: 100 }, // % needed to pass each quiz
    maxAttempts: { type: Number, default: 3, min: 1, max: 10 }, // per quiz
    estimatedHours: { type: Number, default: 1, min: 0 },
    thumbnailUrl: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.LEVELS = LEVELS;
