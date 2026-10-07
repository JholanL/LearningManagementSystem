const { body } = require('express-validator');
const { CATEGORIES, LEVELS } = require('../models/Course');
const { optionalUrl } = require('./common');

const courseBody = (isUpdate = false) => {
  const req = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    req(body('code'))
      .trim()
      .notEmpty()
      .withMessage('Course code is required')
      .matches(/^[A-Za-z0-9-]{2,20}$/)
      .withMessage('Code must be 2-20 letters, numbers or dashes'),
    req(body('title')).trim().notEmpty().withMessage('Title is required').isLength({ max: 120 }),
    req(body('description')).trim().notEmpty().withMessage('Description is required').isLength({ max: 2000 }),
    req(body('category')).isIn(CATEGORIES).withMessage(`Category must be one of: ${CATEGORIES.join(', ')}`),
    body('level').optional().isIn(LEVELS).withMessage(`Level must be one of: ${LEVELS.join(', ')}`),
    body('passingScore').optional().isInt({ min: 1, max: 100 }).withMessage('Passing score must be 1-100').toInt(),
    body('maxAttempts').optional().isInt({ min: 1, max: 10 }).withMessage('Max attempts must be 1-10').toInt(),
    body('estimatedHours').optional().isFloat({ min: 0, max: 200 }).toFloat(),
    optionalUrl('thumbnailUrl'),
  ];
};

const lessonBody = (isUpdate = false) => {
  const req = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    req(body('title')).trim().notEmpty().withMessage('Lesson title is required').isLength({ max: 150 }),
    req(body('content')).notEmpty().withMessage('Lesson content is required').isLength({ max: 20000 }),
    optionalUrl('videoUrl'),
    body('order').optional().isInt({ min: 1 }).toInt(),
    body('durationMinutes').optional().isInt({ min: 0, max: 600 }).toInt(),
  ];
};

module.exports = {
  createCourse: courseBody(false),
  updateCourse: courseBody(true),
  createLesson: lessonBody(false),
  updateLesson: lessonBody(true),
};
