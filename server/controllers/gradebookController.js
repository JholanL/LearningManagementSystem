const Assignment = require('../models/Assignment');
const Enrollment = require('../models/Enrollment');
const Submission = require('../models/Submission');
const { loadCourse } = require('../utils/courseAccess');

// Every enrolled student's result for every assignment in a course.
// A student's percent only counts work that has been graded so far.
exports.getGradebook = async (req, res) => {
  const course = await loadCourse(req.params.courseId, req, res, { manage: true });
  if (!course) return;

  const [assignments, enrollments, submissions] = await Promise.all([
    Assignment.find({ course: course._id }).sort({ createdAt: 1 }),
    Enrollment.find({ course: course._id }).sort({ createdAt: 1 }).populate('student', 'name email'),
    Submission.find({ course: course._id }).select('assignment student grade submittedAt'),
  ]);

  const byStudentAndAssignment = new Map(
    submissions.map((submission) => [`${submission.student}:${submission.assignment}`, submission])
  );

  const students = enrollments
    .filter((enrollment) => enrollment.student)
    .map(({ student }) => {
      let earned = 0;
      let possible = 0;
      const grades = {};

      for (const assignment of assignments) {
        const submission = byStudentAndAssignment.get(`${student._id}:${assignment._id}`);
        grades[assignment._id] = submission
          ? {
              grade: submission.grade,
              late: Boolean(assignment.dueDate && submission.submittedAt > assignment.dueDate),
            }
          : null;
        if (submission && submission.grade !== null) {
          earned += submission.grade;
          possible += assignment.points;
        }
      }

      return {
        id: student._id,
        name: student.name,
        email: student.email,
        grades,
        earned,
        possible,
        percent: possible ? Math.round((earned / possible) * 1000) / 10 : null,
      };
    });

  res.json({
    assignments: assignments.map((assignment) => ({
      id: assignment._id,
      title: assignment.title,
      points: assignment.points,
      dueDate: assignment.dueDate,
    })),
    students,
  });
};
