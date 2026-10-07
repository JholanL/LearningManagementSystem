const router = require('express').Router();
const course = require('../controllers/courseController');
const lesson = require('../controllers/lessonController');
const quiz = require('../controllers/quizController');
const v = require('../validators/courseValidators');
const qv = require('../validators/quizValidators');
const validate = require('../middleware/validate');
const { mongoIdParam } = require('../validators/common');
const { protect, authorize } = require('../middleware/auth');

const staff = authorize('admin', 'trainer');

router.use(protect);

// Courses
router.route('/').get(course.getCourses).post(staff, v.createCourse, validate, course.createCourse);
router
  .route('/:id')
  .get(mongoIdParam(), validate, course.getCourse)
  .put(staff, mongoIdParam(), v.updateCourse, validate, course.updateCourse)
  .delete(staff, mongoIdParam(), validate, course.deleteCourse);
router.patch('/:id/publish', staff, mongoIdParam(), validate, course.togglePublish);

// Nested: lessons and quizzes of a course
router
  .route('/:courseId/lessons')
  .get(mongoIdParam('courseId'), validate, lesson.getLessons)
  .post(staff, mongoIdParam('courseId'), v.createLesson, validate, lesson.createLesson);
router
  .route('/:courseId/quizzes')
  .get(mongoIdParam('courseId'), validate, quiz.getQuizzes)
  .post(staff, mongoIdParam('courseId'), qv.createQuiz, validate, quiz.createQuiz);

module.exports = router;
