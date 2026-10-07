const express = require('express');
const {
  joinCourse,
  getMyEnrollments,
  leaveCourse,
} = require('../controllers/enrollmentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect, authorize('student'));

router.post('/', joinCourse);
router.get('/me', getMyEnrollments);
router.delete('/:courseId', leaveCourse);

module.exports = router;
