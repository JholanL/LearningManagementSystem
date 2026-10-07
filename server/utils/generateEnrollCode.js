const crypto = require('crypto');

// No 0, O, 1, or I so the code is easy to read out loud and type.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LENGTH = 6;

module.exports = () =>
  Array.from({ length: LENGTH }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
