const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Progress = require('../models/Progress');
const Certificate = require('../models/Certificate');
const Batch = require('../models/Batch');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');
const { paginate, searchFilter } = require('../utils/query');
const { getAgentCourseIds, assertCanViewCourse, assertCanEditCourse } = require('../services/accessService');
const { buildProgressMatrix } = require('../services/progressService');

const FIELDS = ['code', 'title', 'description', 'category', 'level', 'passingScore', 'maxAttempts', 'estimatedHours', 'thumbnailUrl'];

// GET /api/courses?search=&category=&level=&isPublished=&mine=true&page=&limit=
// Admin/Trainer: all courses. Agent: published courses in their batch (+ their progress %).
exports.getCourses = asyncHandler(async (req, res) => {
  const { search, category, level, isPublished, mine } = req.query;
  const filter = { ...searchFilter(search, ['title', 'code', 'description']) };
  if (category) filter.category = category;
  if (level) filter.level = level;

  if (req.user.role === 'agent') {
    filter._id = { $in: await getAgentCourseIds(req.user) };
  } else {
    if (isPublished !== undefined && isPublished !== '') filter.isPublished = isPublished === 'true';
    if (mine === 'true') filter.createdBy = req.user._id;
  }

  const result = await paginate(Course, filter, req.query, {
    populate: { path: 'createdBy', select: 'firstName lastName' },
  });

  const ids = result.data.map((c) => c._id);
  const [lessonCounts, quizCounts] = await Promise.all([
    Promise.all(ids.map((id) => Lesson.countDocuments({ course: id }))),
    Promise.all(ids.map((id) => Quiz.countDocuments({ course: id }))),
  ]);
  const matrix = req.user.role === 'agent' ? await buildProgressMatrix([req.user._id], ids) : null;

  const data = result.data.map((c, i) => ({
    ...c.toObject(),
    lessonCount: lessonCounts[i],
    quizCount: quizCounts[i],
    ...(matrix && { progress: pickProgress(matrix[String(req.user._id)][String(c._id)]) }),
  }));
  res.json({ success: true, data, pagination: result.pagination });
});

const pickProgress = (p) => ({
  percent: p.percent,
  status: p.status,
  completedLessons: p.completedLessons,
  totalLessons: p.totalLessons,
  passedQuizzes: p.passedQuizzes,
  totalQuizzes: p.totalQuizzes,
});

// GET /api/courses/:id  - course + lessons + quizzes (+ agent progress)
exports.getCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id).populate('createdBy', 'firstName lastName');
  if (!course) throw new ApiError(404, 'Course not found');
  await assertCanViewCourse(req.user, course);

  const [lessons, quizzes] = await Promise.all([
    Lesson.find({ course: course._id }).select('title order durationMinutes videoUrl').sort('order'),
    Quiz.find({ course: course._id }).select('title description timeLimitMinutes questions'),
  ]);

  let progress = null;
  let certificate = null;
  if (req.user.role === 'agent') {
    const matrix = await buildProgressMatrix([req.user._id], [course._id]);
    progress = matrix[String(req.user._id)][String(course._id)];
    certificate = await Certificate.findOne({ user: req.user._id, course: course._id }).select('code issuedAt finalScore');
    await Progress.updateOne(
      { user: req.user._id, course: course._id },
      { $set: { lastAccessedAt: new Date() }, $setOnInsert: { status: 'in_progress' } },
      { upsert: true }
    );
  }

  res.json({
    success: true,
    data: {
      ...course.toObject(),
      lessons: lessons.map((l) => ({
        ...l.toObject(),
        ...(progress && { completed: progress.completedLessonIds.includes(String(l._id)) }),
      })),
      quizzes: quizzes.map((q) => {
        const base = {
          _id: q._id,
          title: q.title,
          description: q.description,
          timeLimitMinutes: q.timeLimitMinutes,
          questionCount: q.questions.length,
          totalPoints: q.totalPoints,
        };
        if (!progress) return base;
        const s = progress.quizzes[String(q._id)];
        return { ...base, bestScore: s.attempts ? s.best : null, passed: s.passed, attemptsUsed: s.attempts };
      }),
      ...(progress && { progress: pickProgress(progress) }),
      ...(req.user.role === 'agent' && { certificate }),
    },
  });
});

// POST /api/courses   (trainer, admin)
exports.createCourse = asyncHandler(async (req, res) => {
  const course = await Course.create({ ...pick(req.body, FIELDS), createdBy: req.user._id });
  res.status(201).json({ success: true, message: 'Course created.', data: course });
});

// PUT /api/courses/:id   (owner trainer, admin)
exports.updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw new ApiError(404, 'Course not found');
  assertCanEditCourse(req.user, course);
  Object.assign(course, pick(req.body, FIELDS));
  await course.save();
  res.json({ success: true, message: 'Course updated.', data: course });
});

// PATCH /api/courses/:id/publish   (owner trainer, admin) - toggles published state
exports.togglePublish = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw new ApiError(404, 'Course not found');
  assertCanEditCourse(req.user, course);
  if (!course.isPublished && !(await Lesson.exists({ course: course._id }))) {
    throw new ApiError(400, 'Add at least one lesson before publishing.');
  }
  course.isPublished = !course.isPublished;
  await course.save();
  res.json({ success: true, message: course.isPublished ? 'Course published.' : 'Course unpublished.', data: course });
});

// DELETE /api/courses/:id   (owner trainer, admin) - removes lessons, quizzes and learner records
exports.deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw new ApiError(404, 'Course not found');
  assertCanEditCourse(req.user, course);

  await Promise.all([
    Lesson.deleteMany({ course: course._id }),
    Quiz.deleteMany({ course: course._id }),
    QuizAttempt.deleteMany({ course: course._id }),
    Progress.deleteMany({ course: course._id }),
    Certificate.deleteMany({ course: course._id }),
    Batch.updateMany({ courses: course._id }, { $pull: { courses: course._id } }),
  ]);
  await course.deleteOne();
  res.json({ success: true, message: 'Course deleted.' });
});
