const ID_REGEX = /^[0-9a-fA-F]{24}$/;

exports.isValidId = (id) => typeof id === 'string' && ID_REGEX.test(id);

exports.isHttpUrl = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

// Reads text fields from a request body.
// rules looks like { title: { max: 150, required: true }, code: { max: 20 } }.
// With partial = true (updates), fields that were not sent are skipped.
exports.readStrings = (body, rules, partial) => {
  const source = body || {};
  const input = {};

  for (const [field, rule] of Object.entries(rules)) {
    const value = source[field];

    if (value === undefined) {
      if (rule.required && !partial) return { error: `${field} is required` };
      continue;
    }
    if (typeof value !== 'string') {
      return { error: `${field} must be text` };
    }
    if (rule.required && !value.trim()) {
      return { error: `${field} is required` };
    }
    if (value.trim().length > rule.max) {
      return { error: `${field} must be at most ${rule.max} characters` };
    }
    input[field] = value.trim();
  }

  return { input };
};
