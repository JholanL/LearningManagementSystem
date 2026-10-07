const { body } = require('express-validator');
const { strongPassword, name, phPhone, optionalUrl } = require('./common');

const register = [
  name('firstName', 'First name'),
  name('lastName', 'Last name'),
  body('email').trim().isEmail().withMessage('Valid email is required').toLowerCase(),
  strongPassword('password'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
  body('employeeId')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[A-Za-z0-9-]{3,20}$/)
    .withMessage('Employee ID must be 3-20 letters, numbers or dashes'),
  phPhone(),
];

const login = [
  body('email').trim().isEmail().withMessage('Valid email is required').toLowerCase(),
  body('password').notEmpty().withMessage('Password is required'),
];

const updateMe = [
  name('firstName', 'First name').optional(),
  name('lastName', 'Last name').optional(),
  phPhone(),
  optionalUrl('avatarUrl'),
];

const changePassword = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  strongPassword('newPassword'),
  body('newPassword')
    .custom((value, { req }) => value !== req.body.currentPassword)
    .withMessage('New password must be different from the current one'),
];

module.exports = { register, login, updateMe, changePassword };
