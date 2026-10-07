const fs = require('fs');
const Enrollment = require('../models/Enrollment');
const Lesson = require('../models/Lesson');
const { removeLessonFiles } = require('../utils/cleanup');
const { loadCourse, loadLesson } = require('../utils/courseAccess');
const { toProgress } = require('../utils/courseStats');
const { getUploadPath, removeFile } = require('../utils/uploads');
const { isHttpUrl, isValidId, readStrings } = require('../utils/validation');

const MAX_ATTACHMENTS = 5;

const FIELDS = {
  title: { max: 150, required: true },
  content: { max: 20000 },
  videoUrl: { max: 500 },
};

const readInput = (body, partial) => {
  const { input, error } = readStrings(body, FIELDS, partial);
  if (error) return { error };

  if (input.videoUrl && !isHttpUrl(input.videoUrl)) {
    return { error: 'videoUrl must be a valid http or https link' };
  }

  const { order } = body || {};
  if (order !== undefined) {
    if (!Number.isInteger(order) || order < 1) {
      return { error: 'order must be a positive whole number' };
    }
    input.order = order;
  }

  if (Object.keys(input).length === 0) {
    return { error: 'Nothing to update' };
  }
  return { input };
};

// Ids of the lessons this student has finished, or null for instructors and admins.
const getCompletedSet = async (courseId, user) => {
  if (user.role !== 'student') return null;
  const enrollment = await Enrollment.findOne({ course: courseId, student: user._id }).select(
    'completedLessons'
  );
  return new Set((enrollment ? enrollment.completedLessons : []).map(String));
};

const formatLesson = (lesson, completedSet) => ({
  id: lesson._id,
  course: lesson.course,
  title: lesson.title,
  content: lesson.content,
  videoUrl: lesson.videoUrl,
  order: lesson.order,
  attachments: lesson.attachments.map((file) => ({
    id: file._id,
    name: file.originalName,
    size: file.size,
    mimeType: file.mimeType,
  })),
  completed: completedSet ? completedSet.has(String(lesson._id)) : undefined,
  createdAt: lesson.createdAt,
  updatedAt: lesson.updatedAt,
});

// The list leaves out lesson content to stay small. Open one lesson to read it.
exports.getLessons = async (req, res) => {
  const course = await loadCourse(req.params.courseId, req, res);
  if (!course) return;

  const [lessons, completedSet] = await Promise.all([
    Lesson.find({ course: course._id }).sort({ order: 1, createdAt: 1 }).select('-content'),
    getCompletedSet(course._id, req.user),
  ]);

  res.json({
    data: lessons.map((lesson) => formatLesson(lesson, completedSet)),
    progress: completedSet ? toProgress(completedSet.size, lessons.length) : undefined,
  });
};

exports.getLesson = async (req, res) => {
  const found = await loadLesson(req.params.id, req, res);
  if (!found) return;

  const completedSet = await getCompletedSet(found.course._id, req.user);

  res.json({ lesson: formatLesson(found.lesson, completedSet) });
};

exports.createLesson = async (req, res) => {
  const course = await loadCourse(req.params.courseId, req, res, { manage: true });
  if (!course) return;

  const { input, error } = readInput(req.body, false);
  if (error) {
    return res.status(400).json({ message: error });
  }

  // New lessons go to the end unless an order was given.
  if (input.order === undefined) {
    const last = await Lesson.findOne({ course: course._id }).sort({ order: -1 }).select('order');
    input.order = last ? last.order + 1 : 1;
  }

  const lesson = await Lesson.create({ ...input, course: course._id });

  res.status(201).json({ lesson: formatLesson(lesson) });
};

exports.updateLesson = async (req, res) => {
  const found = await loadLesson(req.params.id, req, res, { manage: true });
  if (!found) return;

  const { input, error } = readInput(req.body, true);
  if (error) {
    return res.status(400).json({ message: error });
  }

  found.lesson.set(input);
  await found.lesson.save();

  res.json({ lesson: formatLesson(found.lesson) });
};

exports.deleteLesson = async (req, res) => {
  const found = await loadLesson(req.params.id, req, res, { manage: true });
  if (!found) return;

  await removeLessonFiles([found.lesson]);
  await found.lesson.deleteOne();
  // Keep students' progress counts accurate.
  await Enrollment.updateMany(
    { course: found.course._id },
    { $pull: { completedLessons: found.lesson._id } }
  );

  res.json({ message: 'Lesson deleted' });
};

// Used for both "mark as complete" and undoing it.
exports.setLessonCompletion = (completed) => async (req, res) => {
  const found = await loadLesson(req.params.id, req, res);
  if (!found) return;

  const change = completed
    ? { $addToSet: { completedLessons: found.lesson._id } }
    : { $pull: { completedLessons: found.lesson._id } };

  const [enrollment, total] = await Promise.all([
    Enrollment.findOneAndUpdate(
      { course: found.course._id, student: req.user._id },
      change,
      { returnDocument: 'after' }
    ),
    Lesson.countDocuments({ course: found.course._id }),
  ]);

  res.json({
    completed,
    progress: toProgress(enrollment.completedLessons.length, total),
  });
};

exports.addAttachment = async (req, res) => {
  // The upload is already on disk by the time this runs, so remove it if we reject the request.
  let keepFile = false;

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Choose a file to attach' });
    }

    const found = await loadLesson(req.params.id, req, res, { manage: true });
    if (!found) return;
    const { lesson } = found;

    if (lesson.attachments.length >= MAX_ATTACHMENTS) {
      return res
        .status(400)
        .json({ message: `A lesson can have at most ${MAX_ATTACHMENTS} files` });
    }

    lesson.attachments.push({
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
    await lesson.save();
    keepFile = true;

    res.status(201).json({ lesson: formatLesson(lesson) });
  } finally {
    if (!keepFile && req.file) {
      await removeFile(req.file.filename);
    }
  }
};

exports.deleteAttachment = async (req, res) => {
  const found = await loadLesson(req.params.id, req, res, { manage: true });
  if (!found) return;

  const file = isValidId(req.params.fileId) && found.lesson.attachments.id(req.params.fileId);
  if (!file) {
    return res.status(404).json({ message: 'File not found' });
  }

  const { storedName } = file;
  file.deleteOne();
  await found.lesson.save();
  await removeFile(storedName);

  res.json({ lesson: formatLesson(found.lesson) });
};

// Anyone who can open the lesson can download its files.
exports.downloadAttachment = async (req, res) => {
  const found = await loadLesson(req.params.id, req, res);
  if (!found) return;

  const file = isValidId(req.params.fileId) && found.lesson.attachments.id(req.params.fileId);
  const filePath = file && getUploadPath(file.storedName);
  if (!file || !fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File not found' });
  }

  res.download(filePath, file.originalName);
};
