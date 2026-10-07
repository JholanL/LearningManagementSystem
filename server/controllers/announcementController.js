const Announcement = require('../models/Announcement');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const { loadCourse } = require('../utils/courseAccess');
const { isValidId, readStrings } = require('../utils/validation');

const FIELDS = {
  title: { max: 150, required: true },
  body: { max: 5000, required: true },
};
const FEED_LIMIT = 10;

const readInput = (body, partial) => {
  const { input, error } = readStrings(body, FIELDS, partial);
  if (error) return { error };
  if (Object.keys(input).length === 0) return { error: 'Nothing to update' };
  return { input };
};

const formatAnnouncement = (announcement) => ({
  id: announcement._id,
  course:
    announcement.course && announcement.course.title
      ? { id: announcement.course._id, title: announcement.course.title }
      : announcement.course,
  title: announcement.title,
  body: announcement.body,
  author: announcement.author
    ? { id: announcement.author._id, name: announcement.author.name }
    : null,
  createdAt: announcement.createdAt,
  updatedAt: announcement.updatedAt,
});

// Loads an announcement the user is allowed to change. Sends the error itself.
const loadForManage = async (req, res) => {
  if (!isValidId(req.params.id)) {
    res.status(400).json({ message: 'Invalid announcement id' });
    return null;
  }
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) {
    res.status(404).json({ message: 'Announcement not found' });
    return null;
  }
  const course = await loadCourse(String(announcement.course), req, res, { manage: true });
  return course ? announcement : null;
};

exports.getAnnouncements = async (req, res) => {
  const course = await loadCourse(req.params.courseId, req, res);
  if (!course) return;

  const announcements = await Announcement.find({ course: course._id })
    .sort({ createdAt: -1 })
    .populate('author', 'name');

  res.json({ data: announcements.map(formatAnnouncement) });
};

exports.createAnnouncement = async (req, res) => {
  const course = await loadCourse(req.params.courseId, req, res, { manage: true });
  if (!course) return;

  const { input, error } = readInput(req.body, false);
  if (error) {
    return res.status(400).json({ message: error });
  }

  const announcement = await Announcement.create({
    ...input,
    course: course._id,
    author: req.user._id,
  });
  await announcement.populate('author', 'name');

  res.status(201).json({ announcement: formatAnnouncement(announcement) });
};

exports.updateAnnouncement = async (req, res) => {
  const announcement = await loadForManage(req, res);
  if (!announcement) return;

  const { input, error } = readInput(req.body, true);
  if (error) {
    return res.status(400).json({ message: error });
  }

  announcement.set(input);
  await announcement.save();
  await announcement.populate('author', 'name');

  res.json({ announcement: formatAnnouncement(announcement) });
};

exports.deleteAnnouncement = async (req, res) => {
  const announcement = await loadForManage(req, res);
  if (!announcement) return;

  await announcement.deleteOne();

  res.json({ message: 'Announcement deleted' });
};

// Latest announcements from every published course the student is enrolled in.
exports.getFeed = async (req, res) => {
  const enrolledIds = await Enrollment.find({ student: req.user._id }).distinct('course');
  const courseIds = await Course.find({ _id: { $in: enrolledIds }, status: 'published' }).distinct(
    '_id'
  );

  const announcements = await Announcement.find({ course: { $in: courseIds } })
    .sort({ createdAt: -1 })
    .limit(FEED_LIMIT)
    .populate('author', 'name')
    .populate('course', 'title');

  res.json({ data: announcements.map(formatAnnouncement) });
};
