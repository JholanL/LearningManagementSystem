const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Lesson = require('../models/Lesson');
const Submission = require('../models/Submission');
const { deleteCourseData } = require('../utils/cleanup');
const { canManage, loadCourse } = require('../utils/courseAccess');
const { countByCourse } = require('../utils/courseStats');
const formatCourse = require('../utils/formatCourse');
const generateEnrollCode = require('../utils/generateEnrollCode');
const { isValidId, readStrings } = require('../utils/validation');

const FIELDS = {
  title: { max: 150, required: true },
  description: { max: 2000, required: true },
  code: { max: 20 },
  category: { max: 50 },
};
const STATUSES = ['draft', 'published'];

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toPositiveInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

const readInput = (body, partial) => {
  const { input, error } = readStrings(body, FIELDS, partial);
  if (error) return { error };

  const { status } = body || {};
  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      return { error: 'status must be draft or published' };
    }
    input.status = status;
  }

  if (Object.keys(input).length === 0) {
    return { error: 'Nothing to update' };
  }
  return { input };
};

// Saves the course with a fresh enroll code, retrying if the code is already taken.
const saveWithNewCode = async (course) => {
  for (let attempt = 1; ; attempt += 1) {
    course.enrollCode = generateEnrollCode();
    try {
      return await course.save();
    } catch (err) {
      if (err.code !== 11000 || attempt >= 5) throw err;
    }
  }
};

exports.getCourses = async (req, res) => {
  const page = Math.min(toPositiveInt(req.query.page, 1), 10000);
  const limit = Math.min(toPositiveInt(req.query.limit, 10), 50);
  const search =
    typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const category =
    typeof req.query.category === 'string' ? req.query.category.trim().slice(0, 50) : '';
  const { role, _id: userId } = req.user;

  const conditions = [];
  if (search) {
    const pattern = escapeRegex(search);
    conditions.push({
      $or: [
        { title: { $regex: pattern, $options: 'i' } },
        { description: { $regex: pattern, $options: 'i' } },
        { code: { $regex: pattern, $options: 'i' } },
      ],
    });
  }
  if (category) {
    conditions.push({ category });
  }

  // Students only ever see published courses. ?enrolled=true narrows to their own.
  let enrolledIds = null;
  if (role === 'student') {
    enrolledIds = await Enrollment.find({ student: userId }).distinct('course');
    conditions.push({ status: 'published' });
    if (req.query.enrolled === 'true') {
      conditions.push({ _id: { $in: enrolledIds } });
    }
  } else {
    // Instructors see published courses plus their own drafts. ?mine=true narrows to their own.
    if (role === 'instructor') {
      conditions.push(
        req.query.mine === 'true'
          ? { instructor: userId }
          : { $or: [{ status: 'published' }, { instructor: userId }] }
      );
    }
    if (STATUSES.includes(req.query.status)) {
      conditions.push({ status: req.query.status });
    }
  }

  const filter = conditions.length ? { $and: conditions } : {};

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('instructor', 'name'),
    Course.countDocuments(filter),
  ]);

  const ids = courses.map((course) => course._id);
  const [lessonCounts, studentCounts] = await Promise.all([
    countByCourse(Lesson, ids),
    countByCourse(Enrollment, ids),
  ]);
  const enrolledSet = enrolledIds ? new Set(enrolledIds.map(String)) : null;

  res.json({
    data: courses.map((course) => {
      const key = String(course._id);
      return formatCourse(course, {
        manage: canManage(course, req.user),
        lessonCount: lessonCounts.get(key) || 0,
        studentCount: studentCounts.get(key) || 0,
        enrolled: enrolledSet ? enrolledSet.has(key) : undefined,
      });
    }),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
};

// Numbers for the instructor dashboard. Admins get them for every course.
exports.getSummary = async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { instructor: req.user._id };
  const courseIds = await Course.find(filter).distinct('_id');

  const [publishedCount, studentCount, ungradedCount, toGrade] = await Promise.all([
    Course.countDocuments({ ...filter, status: 'published' }),
    Enrollment.countDocuments({ course: { $in: courseIds } }),
    Submission.countDocuments({ course: { $in: courseIds }, grade: null }),
    // Assignments with ungraded work, the ones waiting longest first.
    Submission.aggregate([
      { $match: { course: { $in: courseIds }, grade: null } },
      { $group: { _id: '$assignment', count: { $sum: 1 }, oldest: { $min: '$submittedAt' } } },
      { $sort: { oldest: 1 } },
      { $limit: 5 },
      { $lookup: { from: 'assignments', localField: '_id', foreignField: '_id', as: 'assignment' } },
      { $unwind: '$assignment' },
      { $lookup: { from: 'courses', localField: 'assignment.course', foreignField: '_id', as: 'course' } },
      { $unwind: '$course' },
      {
        $project: {
          _id: 0,
          assignmentId: '$_id',
          assignmentTitle: '$assignment.title',
          courseId: '$course._id',
          courseTitle: '$course.title',
          count: 1,
        },
      },
    ]),
  ]);

  res.json({
    courseCount: courseIds.length,
    publishedCount,
    studentCount,
    ungradedCount,
    toGrade,
  });
};

exports.getCourse = async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid course id' });
  }

  const course = await Course.findById(req.params.id).populate('instructor', 'name');
  const manage = Boolean(course) && canManage(course, req.user);

  // A draft looks like it does not exist to anyone who cannot manage it.
  if (!course || (!manage && course.status !== 'published')) {
    return res.status(404).json({ message: 'Course not found' });
  }

  // Courses created before enroll codes existed get one the first time they are opened.
  if (manage && !course.enrollCode) {
    await saveWithNewCode(course);
  }

  const isStudent = req.user.role === 'student';
  const [lessonCount, studentCount, enrollment] = await Promise.all([
    Lesson.countDocuments({ course: course._id }),
    Enrollment.countDocuments({ course: course._id }),
    isStudent ? Enrollment.exists({ course: course._id, student: req.user._id }) : null,
  ]);

  res.json({
    course: formatCourse(course, {
      manage,
      lessonCount,
      studentCount,
      enrolled: isStudent ? Boolean(enrollment) : undefined,
    }),
  });
};

exports.createCourse = async (req, res) => {
  const { input, error } = readInput(req.body, false);
  if (error) {
    return res.status(400).json({ message: error });
  }

  const course = new Course({ ...input, instructor: req.user._id });
  await saveWithNewCode(course);
  await course.populate('instructor', 'name');

  res.status(201).json({
    course: formatCourse(course, { manage: true, lessonCount: 0, studentCount: 0 }),
  });
};

exports.updateCourse = async (req, res) => {
  const course = await loadCourse(req.params.id, req, res, { manage: true });
  if (!course) return;

  const { input, error } = readInput(req.body, true);
  if (error) {
    return res.status(400).json({ message: error });
  }

  course.set(input);
  await course.save();
  await course.populate('instructor', 'name');

  res.json({ course: formatCourse(course, { manage: true }) });
};

exports.regenerateEnrollCode = async (req, res) => {
  const course = await loadCourse(req.params.id, req, res, { manage: true });
  if (!course) return;

  await saveWithNewCode(course);

  res.json({ enrollCode: course.enrollCode });
};

exports.deleteCourse = async (req, res) => {
  const course = await loadCourse(req.params.id, req, res, { manage: true });
  if (!course) return;

  await deleteCourseData(course._id);
  await course.deleteOne();

  res.json({ message: 'Course deleted' });
};
