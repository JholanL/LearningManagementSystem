const { body, param } = require('express-validator');
const { CATEGORIES } = require('../models/KbArticle');

const kbBody = (isUpdate = false) => {
  const req = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    req(body('title')).trim().notEmpty().withMessage('Title is required').isLength({ max: 150 }),
    req(body('category')).isIn(CATEGORIES).withMessage(`Category must be one of: ${CATEGORIES.join(', ')}`),
    req(body('body')).isString().notEmpty().withMessage('Body is required').isLength({ max: 20000 }),
    body('summary').optional().trim().isLength({ max: 300 }),
    body('account').optional().trim().isLength({ max: 100 }),
    body('status').optional().isIn(['draft', 'published']).withMessage('Invalid status'),
    body('tags').optional().isArray({ max: 10 }).withMessage('Up to 10 tags'),
    body('tags.*').optional().isString().trim().isLength({ max: 30 }),
    body('relatedCourses').optional().isArray(),
    body('relatedCourses.*').optional().isMongoId().withMessage('Invalid course id'),
  ];
};

const feedback = [body('helpful').isBoolean().withMessage('helpful must be true or false').toBoolean()];

const slugParam = [param('slug').trim().notEmpty().withMessage('Invalid slug').isLength({ max: 120 })];

module.exports = {
  createArticle: kbBody(false),
  updateArticle: kbBody(true),
  feedback,
  slugParam,
};
