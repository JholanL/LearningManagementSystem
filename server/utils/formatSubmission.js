// Shapes a submission for API responses. Pass the assignment's due date to flag late work.
module.exports = (submission, dueDate) => ({
  id: submission._id,
  assignment: submission.assignment,
  student:
    submission.student && submission.student.name
      ? {
          id: submission.student._id,
          name: submission.student.name,
          email: submission.student.email,
        }
      : submission.student,
  comment: submission.comment,
  file: {
    name: submission.file.originalName,
    size: submission.file.size,
    mimeType: submission.file.mimeType,
  },
  submittedAt: submission.submittedAt,
  late: Boolean(dueDate && submission.submittedAt > dueDate),
  grade: submission.grade,
  feedback: submission.feedback,
  gradedAt: submission.gradedAt,
  returnedAt: submission.returnedAt,
});
