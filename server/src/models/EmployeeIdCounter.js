const mongoose = require('mongoose');

const employeeIdCounterSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'userEmployeeId' },
    sequence: { type: Number, required: true, min: 0 },
  },
  { collection: 'employee_id_counters', versionKey: false }
);

module.exports = mongoose.model('EmployeeIdCounter', employeeIdCounterSchema);
