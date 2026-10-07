const express = require('express');
const {
  getLesson,
  updateLesson,
  deleteLesson,
  setLessonCompletion,
  addAttachment,
  deleteAttachment,
  downloadAttachment,
} = require('../controllers/lessonController');
const { protect, authorize } = require('../middleware/auth');
const { uploadSingleFile } = require('../middleware/upload');

const router = express.Router();
const managers = authorize('instructor', 'admin');

router.use(protect);

router.get('/:id', getLesson);
router.put('/:id', managers, updateLesson);
router.delete('/:id', managers, deleteLesson);
router.post('/:id/complete', authorize('student'), setLessonCompletion(true));
router.delete('/:id/complete', authorize('student'), setLessonCompletion(false));

router.post('/:id/attachments', managers, uploadSingleFile, addAttachment);
router.get('/:id/attachments/:fileId', downloadAttachment);
router.delete('/:id/attachments/:fileId', managers, deleteAttachment);

module.exports = router;
