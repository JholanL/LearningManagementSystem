const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: 2000,
    },
    code: {
      type: String,
      trim: true,
      maxlength: 20,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      maxlength: 50,
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    // Students type this code to join. Sparse so older courses without one don't collide.
    enrollCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
