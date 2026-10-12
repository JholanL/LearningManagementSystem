const EmployeeIdCounter = require('../models/EmployeeIdCounter');
const User = require('../models/User');
const { nextCompanyEmail } = require('./companyEmailService');

const COUNTER_ID = 'userEmployeeId';
const INITIAL_SEQUENCE = 2103;

function sequenceFromEmployeeId(employeeId) {
  const match = /^VL-(\d+)$/.exec(String(employeeId || ''));
  return match ? Number(match[1]) : 0;
}

async function ensureCounter() {
  if (await EmployeeIdCounter.exists({ _id: COUNTER_ID })) return;

  const latest = await User.findOne({ employeeId: /^VL-\d+$/ })
    .select('employeeId')
    .sort({ employeeId: -1 })
    .lean();
  const startingSequence = Math.max(INITIAL_SEQUENCE, sequenceFromEmployeeId(latest?.employeeId));

  try {
    await EmployeeIdCounter.create({ _id: COUNTER_ID, sequence: startingSequence });
  } catch (error) {
    // Another request may initialize the counter first. Its atomic increment remains safe.
    if (error?.code !== 11000) throw error;
  }
}

async function nextEmployeeId() {
  await ensureCounter();
  const counter = await EmployeeIdCounter.findOneAndUpdate(
    { _id: COUNTER_ID },
    { $inc: { sequence: 1 } },
    { new: true }
  ).lean();

  if (!counter) throw new Error('Employee ID counter could not be initialized.');
  return `VL-${String(counter.sequence).padStart(4, '0')}`;
}

async function createUserWithEmployeeId(data) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const employeeId = await nextEmployeeId();
    const email = await nextCompanyEmail(data.firstName, data.lastName);
    try {
      return await User.create({ ...data, employeeId, email });
    } catch (error) {
      if (error?.code === 11000 && (error.keyPattern?.employeeId || error.keyPattern?.email || error.keyValue?.employeeId || error.keyValue?.email)) continue;
      throw error;
    }
  }

  const error = new Error('Could not allocate a unique Employee ID.');
  error.code = 'EMPLOYEE_ID_ALLOCATION_FAILED';
  throw error;
}

module.exports = { createUserWithEmployeeId };
