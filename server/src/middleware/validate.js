const { validationResult } = require('express-validator');

// Put this after an array of express-validator rules.
// Returns 422 with a list of field errors if any rule failed.
module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  return res.status(422).json({
    success: false,
    message: 'Validation failed',
    errors: result.array().map((e) => ({ field: e.path, message: e.msg })),
  });
};
