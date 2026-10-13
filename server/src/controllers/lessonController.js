const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const Progress = require('../models/Progress');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');
const { assertCanViewCourse, assertCanEditCourse } = require('../services/accessService');
const { syncCourseCompletion } = require('../services/progressService');
const { assertLessonUnlocked, nextStep } = require('../services/learningPathService');

const FIELDS = ['title', 'content', 'videoUrl', 'order', 'durationMinutes'];

async function loadLesson(id) {
  const lesson = await Lesson.findById(id);
  if (!lesson) throw new ApiError(404, 'Lesson not found');
  const course = await Course.findById(lesson.course);
  if (!course) throw new ApiError(404, 'Course not found');
  return { lesson, course };
}

// GET /api/courses/:courseId/lessons
exports.getLessons = asyncHandler(async (req, res) => {
  await assertCanViewCourse(req.user, req.params.courseId);
  const lessons = await Lesson.find({ course: req.params.courseId }).sort('order');
  res.json({ success: true, data: lessons });
});

// POST /api/courses/:courseId/lessons   (owner trainer, admin)
exports.createLesson = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) throw new ApiError(404, 'Course not found');
  assertCanEditCourse(req.user, course);

  const data = pick(req.body, FIELDS);
  if (!data.order) data.order = (await Lesson.countDocuments({ course: course._id })) + 1;
  const lesson = await Lesson.create({ ...data, course: course._id });
  res.status(201).json({ success: true, message: 'Lesson created.', data: lesson });
});

// GET /api/lessons/:id  - includes prev/next lesson ids for navigation
exports.getLesson = asyncHandler(async (req, res) => {
  const { lesson, course } = await loadLesson(req.params.id);
  await assertCanViewCourse(req.user, course);

  const siblings = await Lesson.find({ course: course._id }).select('_id title order').sort('order');
  const index = siblings.findIndex((l) => String(l._id) === String(lesson._id));

  let completed;
  let completedCount; // staff: how many agents have already finished this lesson (for the delete warning)
  let lessonQuiz; // agent: the quiz that follows this lesson (if any), + whether they've passed it
  if (req.user.role === 'agent') {
    const progress = await Progress.findOne({ user: req.user._id, course: course._id });
    completed = !!progress?.completedLessons.some((l) => String(l) === String(lesson._id));
    if (!completed) await assertLessonUnlocked(req.user._id, course, lesson); // block skipping ahead

    const quiz = await Quiz.findOne({ course: course._id, lesson: lesson._id }).sort('createdAt').select('title');
    if (quiz) {
      const passed = await QuizAttempt.exists({ user: req.user._id, quiz: quiz._id, passed: true });
      lessonQuiz = { _id: quiz._id, title: quiz.title, passed: !!passed };
    } else {
      lessonQuiz = null;
    }
  } else {
    completedCount = await Progress.countDocuments({ course: course._id, completedLessons: lesson._id });
  }

  res.json({
    success: true,
    data: {
      ...lesson.toObject(),
      courseTitle: course.title,
      prevLesson: siblings[index - 1] || null,
      nextLesson: siblings[index + 1] || null,
      ...(completed !== undefined && { completed }),
      ...(lessonQuiz !== undefined && { lessonQuiz }),
      ...(completedCount !== undefined && { completedCount }),
    },
  });
});

// PUT /api/lessons/:id   (owner trainer, admin)
exports.updateLesson = asyncHandler(async (req, res) => {
  const { lesson, course } = await loadLesson(req.params.id);
  assertCanEditCourse(req.user, course);
  Object.assign(lesson, pick(req.body, FIELDS));
  await lesson.save();
  res.json({ success: true, message: 'Lesson updated.', data: lesson });
});

// DELETE /api/lessons/:id   (owner trainer, admin)
exports.deleteLesson = asyncHandler(async (req, res) => {
  const { lesson, course } = await loadLesson(req.params.id);
  assertCanEditCourse(req.user, course);
  await Progress.updateMany({ course: course._id }, { $pull: { completedLessons: lesson._id } });
  await lesson.deleteOne();
  res.json({ success: true, message: 'Lesson deleted.' });
});

// POST /api/lessons/:id/complete   (agent) - mark lesson as done
exports.completeLesson = asyncHandler(async (req, res) => {
  const { lesson, course } = await loadLesson(req.params.id);
  await assertCanViewCourse(req.user, course);
  await assertLessonUnlocked(req.user._id, course, lesson, { forComplete: true }); // enforce order

  await Progress.updateOne(
    { user: req.user._id, course: course._id },
    { $addToSet: { completedLessons: lesson._id }, $set: { lastAccessedAt: new Date() } },
    { upsert: true }
  );
  const progress = await syncCourseCompletion(req.user._id, course._id);
  const next = await nextStep(req.user._id, course._id); // where to go: this lesson's quiz, the next lesson, etc.

  res.json({
    success: true,
    message: progress.certificate ? 'Course completed! Certificate issued.' : 'Lesson marked as complete.',
    data: {
      percent: progress.percent,
      status: progress.status,
      certificate: progress.certificate,
      next, // { type: 'quiz'|'lesson'|'course', id }
    },
  });
});
