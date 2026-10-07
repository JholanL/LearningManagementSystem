const { param, body } = require('express-validator');

const mongoIdParam = (name = 'id') => param(name).isMongoId().withMessage(`Invalid ${name}`);

// At least 8 chars, with uppercase, lowercase and a number
const strongPassword = (field = 'password') =>
  body(field)
    .isString()
    .isLength({ min: 8, max: 64 })
    .withMessage('Password must be 8-64 characters')
    .matches(/[A-Z]/)
    .withMessage('Password needs at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password needs at least one lowercase letter')
    .matches(/\d/)
    .withMessage('Password needs at least one number');

const name = (field, label) =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage(`${label} is required`)
    .isLength({ max: 50 })
    .withMessage(`${label} must be at most 50 characters`)
    .matches(/^[A-Za-zÀ-ÿñÑ .'-]+$/)
    .withMessage(`${label} contains invalid characters`);

const phPhone = (field = 'phone') =>
  body(field)
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^(09|\+639)\d{9}$/)
    .withMessage('Phone must be a valid PH mobile number (09XXXXXXXXX)');

const optionalUrl = (field) =>
  body(field)
    .optional({ values: 'falsy' })
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage(`${field} must be a valid http(s) URL`);

module.exports = { mongoIdParam, strongPassword, name, phPhone, optionalUrl };
