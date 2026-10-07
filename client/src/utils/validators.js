// Client-side validation (same rules as the backend) so users get instant feedback.
// The backend still validates everything - never trust the client alone.

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());

export const passwordIssues = (v = '') => {
  const issues = [];
  if (v.length < 8) issues.push('at least 8 characters');
  if (!/[A-Z]/.test(v)) issues.push('an uppercase letter');
  if (!/[a-z]/.test(v)) issues.push('a lowercase letter');
  if (!/\d/.test(v)) issues.push('a number');
  return issues;
};

export const isPhPhone = (v) => !v || /^(09|\+639)\d{9}$/.test(String(v).trim());

export const isName = (v) => /^[A-Za-zÀ-ÿñÑ .'-]{1,50}$/.test(String(v).trim());

export const isUrl = (v) => !v || /^https?:\/\/[^\s]+$/.test(String(v).trim());

/**
 * Runs a map of rules and returns { field: 'error message' }.
 * Example:
 *   const errors = validate(form, {
 *     email: [[(v) => !!v, 'Email is required'], [isEmail, 'Invalid email']],
 *   });
 */
export const validate = (values, rules) => {
  const errors = {};
  Object.entries(rules).forEach(([field, checks]) => {
    for (const [test, message] of checks) {
      if (!test(values[field], values)) {
        errors[field] = message;
        break;
      }
    }
  });
  return errors;
};

export const required = (label) => [(v) => v !== undefined && v !== null && String(v).trim() !== '', `${label} is required`];
