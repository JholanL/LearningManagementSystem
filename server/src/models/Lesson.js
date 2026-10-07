const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    content: { type: String, required: true, maxlength: 20000 }, // lesson body (plain text / markdown)
    videoUrl: { type: String, trim: true }, // optional YouTube link (embed on the frontend)
    order: { type: Number, default: 1, min: 1 },
    durationMinutes: { type: Number, default: 10, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lesson', lessonSchema);
