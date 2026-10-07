const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
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
    instructions: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    points: {
      type: Number,
      min: 1,
      max: 1000,
      default: 100,
    },
  },
  { timestamps: true }
);

assignmentSchema.index({ course: 1, createdAt: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
