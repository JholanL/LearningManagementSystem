const Assignment = require('../models/Assignment');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Lesson = require('../models/Lesson');
const { isValidId } = require('./validation');

const fail = (res, status, message) => {
  res.status(status).json({ message });
  return null;
};

// The course's own instructor and any admin can change a course.
const canManage = (course, user) => {
  if (user.role === 'admin') return true;
  if (!course.instructor) return false;
  const ownerId = course.instructor._id || course.instructor;
  return ownerId.equals(user._id);
};

// Lessons and assignments are visible to managers and to enrolled students.
const canViewContent = async (course, user) => {
  if (canManage(course, user)) return true;
  if (user.role !== 'student' || course.status !== 'published') return false;
  return Boolean(await Enrollment.exists({ course: course._id, student: user._id }));
};

// Each loader sends the error response itself and returns null when access fails.
// Pass { manage: true } for actions only the instructor or an admin may do.
const loadCourse = async (courseId, req, res, { manage = false } = {}) => {
  if (!isValidId(courseId)) return fail(res, 400, 'Invalid course id');

  const course = await Course.findById(courseId);
  if (!course) return fail(res, 404, 'Course not found');

  if (manage) {
    if (!canManage(course, req.user)) {
      return fail(res, 403, 'You can only modify your own courses');
    }
    return course;
  }

  if (!(await canViewContent(course, req.user))) {
    return fail(res, 403, 'Enroll in this course to view its content');
  }
  return course;
};

const loadLesson = async (lessonId, req, res, options) => {
  if (!isValidId(lessonId)) return fail(res, 400, 'Invalid lesson id');

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return fail(res, 404, 'Lesson not found');

  const course = await loadCourse(String(lesson.course), req, res, options);
  return course ? { lesson, course } : null;
};

const loadAssignment = async (assignmentId, req, res, options) => {
  if (!isValidId(assignmentId)) return fail(res, 400, 'Invalid assignment id');

  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) return fail(res, 404, 'Assignment not found');

  const course = await loadCourse(String(assignment.course), req, res, options);
  return course ? { assignment, course } : null;
};

module.exports = { canManage, loadCourse, loadLesson, loadAssignment };
