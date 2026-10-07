const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Lesson = require('../models/Lesson');
const { loadCourse } = require('../utils/courseAccess');
const { countByCourse, toProgress } = require('../utils/courseStats');
const formatCourse = require('../utils/formatCourse');
const { isValidId } = require('../utils/validation');

// A student joins a course by typing the code the instructor gave them.
exports.joinCourse = async (req, res) => {
  const { code, courseId } = req.body || {};

  if (typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ message: 'Enroll code is required' });
  }
  if (courseId !== undefined && !isValidId(courseId)) {
    return res.status(400).json({ message: 'Invalid course id' });
  }

  const course = await Course.findOne({
    enrollCode: code.trim().toUpperCase(),
    status: 'published',
  }).populate('instructor', 'name');

  // Sent from a course page: the code has to belong to that course.
  if (!course || (courseId && String(course._id) !== courseId)) {
    return res.status(404).json({ message: 'That enroll code is not correct' });
  }

  try {
    await Enrollment.create({ student: req.user._id, course: course._id });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'You are already enrolled in this course' });
    }
    throw err;
  }

  res.status(201).json({ course: formatCourse(course, { enrolled: true }) });
};

exports.getMyEnrollments = async (req, res) => {
  const enrollments = await Enrollment.find({ student: req.user._id })
    .sort({ createdAt: -1 })
    .populate({ path: 'course', populate: { path: 'instructor', select: 'name' } });

  // Courses that were deleted or moved back to draft are left out.
  const active = enrollments.filter(
    (enrollment) => enrollment.course && enrollment.course.status === 'published'
  );
  const lessonCounts = await countByCourse(
    Lesson,
    active.map((enrollment) => enrollment.course._id)
  );

  res.json({
    data: active.map((enrollment) => ({
      enrolledAt: enrollment.createdAt,
      course: formatCourse(enrollment.course, { enrolled: true }),
      progress: toProgress(
        enrollment.completedLessons.length,
        lessonCounts.get(String(enrollment.course._id)) || 0
      ),
    })),
  });
};

exports.leaveCourse = async (req, res) => {
  if (!isValidId(req.params.courseId)) {
    return res.status(400).json({ message: 'Invalid course id' });
  }

  const enrollment = await Enrollment.findOneAndDelete({
    student: req.user._id,
    course: req.params.courseId,
  });
  if (!enrollment) {
    return res.status(404).json({ message: 'You are not enrolled in this course' });
  }

  res.json({ message: 'You left the course' });
};

// Class list for the instructor or an admin.
exports.getCourseStudents = async (req, res) => {
  const course = await loadCourse(req.params.courseId, req, res, { manage: true });
  if (!course) return;

  const [enrollments, lessonTotal] = await Promise.all([
    Enrollment.find({ course: course._id }).sort({ createdAt: 1 }).populate('student', 'name email'),
    Lesson.countDocuments({ course: course._id }),
  ]);

  res.json({
    data: enrollments
      .filter((enrollment) => enrollment.student)
      .map((enrollment) => ({
        id: enrollment.student._id,
        name: enrollment.student.name,
        email: enrollment.student.email,
        enrolledAt: enrollment.createdAt,
        progress: toProgress(enrollment.completedLessons.length, lessonTotal),
      })),
  });
};

// The instructor or an admin removes a student from the class.
exports.removeCourseStudent = async (req, res) => {
  const course = await loadCourse(req.params.courseId, req, res, { manage: true });
  if (!course) return;

  if (!isValidId(req.params.studentId)) {
    return res.status(400).json({ message: 'Invalid student id' });
  }

  const enrollment = await Enrollment.findOneAndDelete({
    student: req.params.studentId,
    course: course._id,
  });
  if (!enrollment) {
    return res.status(404).json({ message: 'That student is not enrolled in this course' });
  }

  res.json({ message: 'Student removed from the course' });
};
