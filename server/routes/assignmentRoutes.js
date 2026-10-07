const express = require('express');
const {
  getAssignment,
  updateAssignment,
  deleteAssignment,
} = require('../controllers/assignmentController');
const {
  submitAssignment,
  getMySubmission,
  getSubmissions,
} = require('../controllers/submissionController');
const { protect, authorize } = require('../middleware/auth');
const { uploadSingleFile } = require('../middleware/upload');

const router = express.Router();
const managers = authorize('instructor', 'admin');

router.use(protect);

router.get('/:id', getAssignment);
router.put('/:id', managers, updateAssignment);
router.delete('/:id', managers, deleteAssignment);

router.get('/:id/submissions', managers, getSubmissions);
router.get('/:id/submissions/me', authorize('student'), getMySubmission);
router.post('/:id/submissions', authorize('student'), uploadSingleFile, submitAssignment);

module.exports = router;
