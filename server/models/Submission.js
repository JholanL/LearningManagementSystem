const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
    },
    // Copied from the assignment so a course's submissions can be found in one query.
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    file: {
      originalName: { type: String, required: true },
      // Name of the file inside server/uploads.
      storedName: { type: String, required: true },
      mimeType: { type: String, default: '' },
      size: { type: Number, default: 0 },
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    grade: {
      type: Number,
      min: 0,
      default: null,
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    gradedAt: {
      type: Date,
      default: null,
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Set when the instructor asks the student to submit again.
    returnedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// One submission per student per assignment. Resubmitting replaces the file.
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
submissionSchema.index({ course: 1 });

module.exports = mongoose.model('Submission', submissionSchema);
