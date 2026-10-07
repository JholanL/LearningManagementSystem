const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const { deleteSubmissions } = require('../utils/cleanup');
const { loadAssignment, loadCourse } = require('../utils/courseAccess');
const formatSubmission = require('../utils/formatSubmission');
const { readStrings } = require('../utils/validation');

const FIELDS = {
  title: { max: 150, required: true },
  instructions: { max: 5000 },
};
const MAX_POINTS = 1000;

const readInput = (body, partial) => {
  const { input, error } = readStrings(body, FIELDS, partial);
  if (error) return { error };

  const { dueDate, points } = body || {};

  // null or an empty string clears the due date.
  if (dueDate !== undefined) {
    if (dueDate === null || dueDate === '') {
      input.dueDate = null;
    } else {
      const date = typeof dueDate === 'string' ? new Date(dueDate) : null;
      if (!date || Number.isNaN(date.getTime())) {
        return { error: 'dueDate must be a valid date' };
      }
      input.dueDate = date;
    }
  }

  if (points !== undefined) {
    if (!Number.isInteger(points) || points < 1 || points > MAX_POINTS) {
      return { error: `points must be a whole number from 1 to ${MAX_POINTS}` };
    }
    input.points = points;
  }

  if (Object.keys(input).length === 0) {
    return { error: 'Nothing to update' };
  }
  return { input };
};

const formatAssignment = (assignment, extras = {}) => ({
  id: assignment._id,
  course: assignment.course,
  title: assignment.title,
  instructions: assignment.instructions,
  dueDate: assignment.dueDate,
  points: assignment.points,
  createdAt: assignment.createdAt,
  updatedAt: assignment.updatedAt,
  ...extras,
});

// Students get their own submission with each assignment.
// Instructors and admins get how many were submitted and how many still need a grade.
exports.getAssignments = async (req, res) => {
  const course = await loadCourse(req.params.courseId, req, res);
  if (!course) return;

  const assignments = await Assignment.find({ course: course._id }).sort({ createdAt: 1 });
  const ids = assignments.map((assignment) => assignment._id);

  let extrasFor;
  if (req.user.role === 'student') {
    const mine = await Submission.find({ assignment: { $in: ids }, student: req.user._id });
    const byAssignment = new Map(mine.map((submission) => [String(submission.assignment), submission]));
    extrasFor = (assignment) => {
      const submission = byAssignment.get(String(assignment._id));
      return {
        submission: submission ? formatSubmission(submission, assignment.dueDate) : null,
      };
    };
  } else {
    const rows = await Submission.aggregate([
      { $match: { assignment: { $in: ids } } },
      {
        $group: {
          _id: '$assignment',
          submitted: { $sum: 1 },
          ungraded: { $sum: { $cond: [{ $eq: ['$grade', null] }, 1, 0] } },
        },
      },
    ]);
    const byAssignment = new Map(rows.map((row) => [String(row._id), row]));
    extrasFor = (assignment) => {
      const row = byAssignment.get(String(assignment._id));
      return {
        submittedCount: row ? row.submitted : 0,
        ungradedCount: row ? row.ungraded : 0,
      };
    };
  }

  res.json({
    data: assignments.map((assignment) => formatAssignment(assignment, extrasFor(assignment))),
  });
};

exports.getAssignment = async (req, res) => {
  const found = await loadAssignment(req.params.id, req, res);
  if (!found) return;

  const { assignment } = found;
  const extras = {};
  if (req.user.role === 'student') {
    const submission = await Submission.findOne({
      assignment: assignment._id,
      student: req.user._id,
    });
    extras.submission = submission ? formatSubmission(submission, assignment.dueDate) : null;
  }

  res.json({ assignment: formatAssignment(assignment, extras) });
};

exports.createAssignment = async (req, res) => {
  const course = await loadCourse(req.params.courseId, req, res, { manage: true });
  if (!course) return;

  const { input, error } = readInput(req.body, false);
  if (error) {
    return res.status(400).json({ message: error });
  }

  const assignment = await Assignment.create({ ...input, course: course._id });

  res.status(201).json({ assignment: formatAssignment(assignment) });
};

exports.updateAssignment = async (req, res) => {
  const found = await loadAssignment(req.params.id, req, res, { manage: true });
  if (!found) return;

  const { input, error } = readInput(req.body, true);
  if (error) {
    return res.status(400).json({ message: error });
  }

  found.assignment.set(input);
  await found.assignment.save();

  res.json({ assignment: formatAssignment(found.assignment) });
};

exports.deleteAssignment = async (req, res) => {
  const found = await loadAssignment(req.params.id, req, res, { manage: true });
  if (!found) return;

  await deleteSubmissions({ assignment: found.assignment._id });
  await found.assignment.deleteOne();

  res.json({ message: 'Assignment deleted' });
};
