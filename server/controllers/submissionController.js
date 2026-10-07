const fs = require('fs');
const Submission = require('../models/Submission');
const { loadAssignment } = require('../utils/courseAccess');
const formatSubmission = require('../utils/formatSubmission');
const { getUploadPath, removeFile } = require('../utils/uploads');
const { isValidId, readStrings } = require('../utils/validation');

// A student uploads a file for an assignment. Sending again replaces the earlier
// file, until the instructor has graded it.
exports.submitAssignment = async (req, res) => {
  // The upload is already on disk by the time this runs, so remove it if we reject the request.
  let keepFile = false;

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Attach a file to submit' });
    }

    const found = await loadAssignment(req.params.id, req, res);
    if (!found) return;
    const { assignment } = found;

    const { input, error } = readStrings(req.body, { comment: { max: 2000 } }, true);
    if (error) {
      return res.status(400).json({ message: error });
    }

    let submission = await Submission.findOne({
      assignment: assignment._id,
      student: req.user._id,
    });
    if (submission && submission.grade !== null) {
      return res
        .status(409)
        .json({ message: 'This submission is already graded and cannot be replaced' });
    }

    const previousFile = submission ? submission.file.storedName : null;
    if (!submission) {
      submission = new Submission({
        assignment: assignment._id,
        course: assignment.course,
        student: req.user._id,
      });
    }

    submission.set({
      comment: input.comment || '',
      file: {
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
      submittedAt: new Date(),
    });

    try {
      await submission.save();
    } catch (err) {
      // Two uploads at the same moment: the unique index lets only one through.
      if (err.code === 11000) {
        return res.status(409).json({ message: 'Your submission is already being saved' });
      }
      throw err;
    }

    keepFile = true;
    await removeFile(previousFile);

    res.status(201).json({ submission: formatSubmission(submission, assignment.dueDate) });
  } finally {
    if (!keepFile && req.file) {
      await removeFile(req.file.filename);
    }
  }
};

exports.getMySubmission = async (req, res) => {
  const found = await loadAssignment(req.params.id, req, res);
  if (!found) return;

  const submission = await Submission.findOne({
    assignment: found.assignment._id,
    student: req.user._id,
  });

  res.json({
    submission: submission ? formatSubmission(submission, found.assignment.dueDate) : null,
  });
};

// Every student's submission for one assignment, for the instructor or an admin.
exports.getSubmissions = async (req, res) => {
  const found = await loadAssignment(req.params.id, req, res, { manage: true });
  if (!found) return;

  const submissions = await Submission.find({ assignment: found.assignment._id })
    .sort({ submittedAt: -1 })
    .populate('student', 'name email');

  res.json({
    data: submissions.map((submission) => formatSubmission(submission, found.assignment.dueDate)),
  });
};

exports.gradeSubmission = async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid submission id' });
  }

  const submission = await Submission.findById(req.params.id).populate('student', 'name email');
  if (!submission) {
    return res.status(404).json({ message: 'Submission not found' });
  }

  const found = await loadAssignment(String(submission.assignment), req, res, { manage: true });
  if (!found) return;
  const { assignment } = found;

  const { grade } = req.body || {};
  if (typeof grade !== 'number' || !Number.isFinite(grade) || grade < 0 || grade > assignment.points) {
    return res
      .status(400)
      .json({ message: `grade must be a number from 0 to ${assignment.points}` });
  }

  const { input, error } = readStrings(req.body, { feedback: { max: 2000 } }, true);
  if (error) {
    return res.status(400).json({ message: error });
  }

  submission.set({
    grade,
    ...input,
    gradedAt: new Date(),
    gradedBy: req.user._id,
  });
  await submission.save();

  res.json({ submission: formatSubmission(submission, assignment.dueDate) });
};

// Clears the grade so the student can upload a new file. Feedback stays so they
// know what to fix.
exports.returnSubmission = async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid submission id' });
  }

  const submission = await Submission.findById(req.params.id).populate('student', 'name email');
  if (!submission) {
    return res.status(404).json({ message: 'Submission not found' });
  }

  const found = await loadAssignment(String(submission.assignment), req, res, { manage: true });
  if (!found) return;

  submission.set({ grade: null, gradedAt: null, gradedBy: null, returnedAt: new Date() });
  await submission.save();

  res.json({ submission: formatSubmission(submission, found.assignment.dueDate) });
};

// Files are never served as static files. The student who uploaded it, the
// course's instructor, and admins can download it through this route.
exports.downloadSubmissionFile = async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid submission id' });
  }

  const submission = await Submission.findById(req.params.id);
  if (!submission) {
    return res.status(404).json({ message: 'Submission not found' });
  }

  if (!submission.student.equals(req.user._id)) {
    const found = await loadAssignment(String(submission.assignment), req, res, { manage: true });
    if (!found) return;
  }

  const filePath = getUploadPath(submission.file.storedName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'The uploaded file is no longer available' });
  }

  res.download(filePath, submission.file.originalName);
};
