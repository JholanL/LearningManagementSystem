const User = require('../models/User');

const COMPANY_EMAIL_DOMAIN = 'voicelink.ph';

function normalizeNamePart(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function emailBase(firstName, lastName) {
  return [normalizeNamePart(firstName), normalizeNamePart(lastName)].filter(Boolean).join('.');
}

async function nextCompanyEmail(firstName, lastName) {
  const base = emailBase(firstName, lastName);
  if (!base) throw new Error('A company email cannot be generated without a name.');

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const localPart = suffix === 0 ? base : `${base}${suffix + 1}`;
    const email = `${localPart}@${COMPANY_EMAIL_DOMAIN}`;
    if (!(await User.exists({ email }))) return email;
  }

  const error = new Error('Could not allocate a unique company email address.');
  error.code = 'COMPANY_EMAIL_ALLOCATION_FAILED';
  throw error;
}

async function createUserWithGeneratedEmail(data) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const email = await nextCompanyEmail(data.firstName, data.lastName);
    try {
      return await User.create({ ...data, email });
    } catch (error) {
      if (error?.code === 11000 && (error.keyPattern?.email || error.keyValue?.email)) continue;
      throw error;
    }
  }

  const error = new Error('Could not allocate a unique company email address.');
  error.code = 'COMPANY_EMAIL_ALLOCATION_FAILED';
  throw error;
}

module.exports = { COMPANY_EMAIL_DOMAIN, nextCompanyEmail, createUserWithGeneratedEmail };
