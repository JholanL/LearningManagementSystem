const jwt = require('jsonwebtoken');

module.exports = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: 'HS256',
  });