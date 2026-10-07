const ApiError = require('../utils/ApiError');

const notFound = (req, _res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// Central error handler: converts every error into a clean JSON response.
// Stack traces are only shown in development.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Server error';
  let errors = err.details;

  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.name === 'ValidationError') {
    status = 422;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'field';
    message = `That ${field} is already in use.`;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body.';
  }

  if (status >= 500) console.error(err);

  res.status(status).json({
    success: false,
    message: status >= 500 && process.env.NODE_ENV === 'production' ? 'Something went wrong.' : message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === 'development' && status >= 500 && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
