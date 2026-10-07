// Wraps async controllers so thrown errors go to the error middleware
// (no need for try/catch in every controller).
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
