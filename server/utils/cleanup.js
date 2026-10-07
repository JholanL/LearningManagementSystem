const Announcement = require('../models/Announcement');
const Assignment = require('../models/Assignment');
const Enrollment = require('../models/Enrollment');
const Lesson = require('../models/Lesson');
const Submission = require('../models/Submission');
const { removeFile } = require('./uploads');

// Deletes matching submissions together with their uploaded files.
const deleteSubmissions = async (filter) => {
  const submissions = await Submission.find(filter).select('file.storedName');
  await Promise.all(submissions.map((submission) => removeFile(submission.file.storedName)));
  await Submission.deleteMany(filter);
};

// Removes the files attached to the given lessons from disk.
const removeLessonFiles = async (lessons) => {
  const names = lessons.flatMap((lesson) => lesson.attachments.map((file) => file.storedName));
  await Promise.all(names.map(removeFile));
};

// Everything that belongs to a course and should go when the course is deleted.
const deleteCourseData = async (courseId) => {
  await deleteSubmissions({ course: courseId });
  await removeLessonFiles(await Lesson.find({ course: courseId }).select('attachments'));
  await Promise.all([
    Assignment.deleteMany({ course: courseId }),
    Lesson.deleteMany({ course: courseId }),
    Enrollment.deleteMany({ course: courseId }),
    Announcement.deleteMany({ course: courseId }),
  ]);
};

module.exports = { deleteSubmissions, removeLessonFiles, deleteCourseData };
