// Custom error with an HTTP status code.
// Throw this anywhere in a controller: throw new ApiError(404, 'Course not found')
class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

module.exports = ApiError;
