const { body } = require('express-validator');

const quizBody = (isUpdate = false) => {
  const req = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    req(body('title')).trim().notEmpty().withMessage('Quiz title is required').isLength({ max: 150 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('timeLimitMinutes').optional().isInt({ min: 0, max: 180 }).toInt(),
    req(body('questions')).isArray({ min: 1, max: 100 }).withMessage('Provide 1-100 questions'),
    body('questions.*.question').trim().notEmpty().withMessage('Question text is required'),
    body('questions.*.options').isArray({ min: 2, max: 6 }).withMessage('Each question needs 2-6 options'),
    body('questions.*.options.*').trim().notEmpty().withMessage('Options cannot be empty'),
    body('questions.*.correctAnswer')
      .isInt({ min: 0 })
      .withMessage('correctAnswer must be the index of an option')
      .toInt()
      .custom((value, { req: r, path }) => {
        const index = Number(path.match(/questions\[(\d+)\]/)[1]);
        const options = r.body.questions[index].options || [];
        return value < options.length;
      })
      .withMessage('correctAnswer is out of range'),
    body('questions.*.explanation').optional().trim().isLength({ max: 1000 }),
    body('questions.*.points').optional().isInt({ min: 1, max: 100 }).toInt(),
  ];
};

const submitQuiz = [
  body('answers').isArray().withMessage('answers must be an array'),
  body('answers.*').isInt({ min: -1 }).withMessage('Each answer must be an option index (-1 = blank)').toInt(),
  body('timeTakenSeconds').optional().isInt({ min: 0 }).toInt(),
];

module.exports = { createQuiz: quizBody(false), updateQuiz: quizBody(true), submitQuiz };
