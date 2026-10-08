const { body } = require('express-validator');

const submit = [body('answers').isArray({ min: 1, max: 50 }).withMessage('answers must be an array')];

module.exports = { submit };
