const { body } = require('express-validator');
const { strongPassword, name, optionalUrl } = require('./common');
const { ROLES } = require('../models/User');
const CREATABLE_ROLES = ROLES.filter((role) => role !== 'admin');

const requiredAdminPhone = () =>
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required.')
    .bail()
    .matches(/^09[0-9]{9}$/)
    .withMessage('Phone number must start with 09 and contain exactly 11 digits.');

const optionalAdminPhone = () =>
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^09[0-9]{9}$/)
    .withMessage('Phone number must start with 09 and contain exactly 11 digits.');

const createUser = [
  name('firstName', 'First name'),
  name('lastName', 'Last name'),
  strongPassword('password'),
  body('role').isIn(CREATABLE_ROLES).withMessage(`Role must be one of: ${CREATABLE_ROLES.join(', ')}`),
  body('batch').optional({ values: 'null' }).isMongoId().withMessage('Invalid batch'),
  requiredAdminPhone(),
  optionalUrl('avatarUrl'),
];

const updateUser = [
  name('firstName', 'First name').optional(),
  name('lastName', 'Last name').optional(),
  strongPassword('password').optional(),
  body('role').optional().isIn(ROLES).withMessage(`Role must be one of: ${ROLES.join(', ')}`),
  body('batch').optional({ values: 'null' }).isMongoId().withMessage('Invalid batch'),
  body('isActive').optional().isBoolean().withMessage('isActive must be true/false').toBoolean(),
  optionalAdminPhone(),
  optionalUrl('avatarUrl'),
];

module.exports = { createUser, updateUser };
