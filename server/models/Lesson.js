const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 150,
    },
    content: {
      type: String,
      trim: true,
      maxlength: 20000,
      default: '',
    },
    videoUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    // Files the instructor shares with the lesson (slides, handouts).
    attachments: [
      {
        originalName: { type: String, required: true },
        // Name of the file inside server/uploads.
        storedName: { type: String, required: true },
        mimeType: { type: String, default: '' },
        size: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

lessonSchema.index({ course: 1, order: 1 });

module.exports = mongoose.model('Lesson', lessonSchema);
