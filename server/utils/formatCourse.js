// Shapes a course for API responses. The enroll code is only included for
// the people who manage the course. Anything in `extras` is added as-is.
module.exports = (course, { manage = false, ...extras } = {}) => ({
  id: course._id,
  title: course.title,
  description: course.description,
  code: course.code || '',
  category: course.category || '',
  status: course.status,
  instructor: course.instructor
    ? { id: course.instructor._id, name: course.instructor.name }
    : null,
  createdAt: course.createdAt,
  updatedAt: course.updatedAt,
  ...(manage ? { enrollCode: course.enrollCode || null } : {}),
  ...extras,
});
