// Copies only the allowed keys from an object.
// Prevents "mass assignment" (e.g. an agent sending { role: 'admin' } in a profile update).
module.exports = (obj = {}, keys = []) =>
  keys.reduce((acc, key) => {
    if (obj[key] !== undefined) acc[key] = obj[key];
    return acc;
  }, {});
