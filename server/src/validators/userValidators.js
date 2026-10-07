const { body } = require('express-validator');
const { strongPassword, name, phPhone, optionalUrl } = require('./common');
const { ROLES } = require('../models/User');

const createUser = [
  name('firstName', 'First name'),
  name('lastName', 'Last name'),
  body('email').trim().isEmail().withMessage('Valid email is required').toLowerCase(),
  strongPassword('password'),
  body('role').isIn(ROLES).withMessage(`Role must be one of: ${ROLES.join(', ')}`),
  body('employeeId')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[A-Za-z0-9-]{3,20}$/)
    .withMessage('Employee ID must be 3-20 letters, numbers or dashes'),
  body('batch').optional({ values: 'null' }).isMongoId().withMessage('Invalid batch'),
  phPhone(),
  optionalUrl('avatarUrl'),
];

const updateUser = [
  name('firstName', 'First name').optional(),
  name('lastName', 'Last name').optional(),
  body('email').optional().trim().isEmail().withMessage('Valid email is required').toLowerCase(),
  strongPassword('password').optional(),
  body('role').optional().isIn(ROLES).withMessage(`Role must be one of: ${ROLES.join(', ')}`),
  body('employeeId')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[A-Za-z0-9-]{3,20}$/)
    .withMessage('Employee ID must be 3-20 letters, numbers or dashes'),
  body('batch').optional({ values: 'null' }).isMongoId().withMessage('Invalid batch'),
  body('isActive').optional().isBoolean().withMessage('isActive must be true/false').toBoolean(),
  phPhone(),
  optionalUrl('avatarUrl'),
];

module.exports = { createUser, updateUser };
