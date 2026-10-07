const express = require('express');
const {
  gradeSubmission,
  returnSubmission,
  downloadSubmissionFile,
} = require('../controllers/submissionController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
const managers = authorize('instructor', 'admin');

router.use(protect);

router.put('/:id/grade', managers, gradeSubmission);
router.post('/:id/return', managers, returnSubmission);
router.get('/:id/file', downloadSubmissionFile);

module.exports = router;
