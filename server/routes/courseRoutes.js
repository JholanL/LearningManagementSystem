const express = require('express');
const {
  getCourses,
  getSummary,
  getCourse,
  createCourse,
  updateCourse,
  regenerateEnrollCode,
  deleteCourse,
} = require('../controllers/courseController');
const { getLessons, createLesson } = require('../controllers/lessonController');
const { getAssignments, createAssignment } = require('../controllers/assignmentController');
const { getCourseStudents, removeCourseStudent } = require('../controllers/enrollmentController');
const {
  getAnnouncements,
  createAnnouncement,
} = require('../controllers/announcementController');
const { getGradebook } = require('../controllers/gradebookController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
const managers = authorize('instructor', 'admin');

router.use(protect);

router.get('/', getCourses);
// Must come before '/:id' or "summary" would be read as a course id.
router.get('/summary', managers, getSummary);
router.get('/:id', getCourse);
router.post('/', managers, createCourse);
router.put('/:id', managers, updateCourse);
router.delete('/:id', managers, deleteCourse);
router.post('/:id/enroll-code', managers, regenerateEnrollCode);

router.get('/:courseId/lessons', getLessons);
router.post('/:courseId/lessons', managers, createLesson);

router.get('/:courseId/assignments', getAssignments);
router.post('/:courseId/assignments', managers, createAssignment);

router.get('/:courseId/students', managers, getCourseStudents);
router.delete('/:courseId/students/:studentId', managers, removeCourseStudent);

router.get('/:courseId/announcements', getAnnouncements);
router.post('/:courseId/announcements', managers, createAnnouncement);

router.get('/:courseId/gradebook', managers, getGradebook);

module.exports = router;
