const Batch = require('../models/Batch');
const Course = require('../models/Course');
const ApiError = require('../utils/ApiError');

// Courses an agent is allowed to see = published courses in their batch curriculum
async function getAgentCourseIds(user) {
  if (!user.batch) return [];
  const batch = await Batch.findById(user.batch).select('courses');
  if (!batch) return [];
  const published = await Course.find({ _id: { $in: batch.courses }, isPublished: true }).select('_id');
  return published.map((c) => c._id);
}

// Throws 403/404 if the user cannot view this course
async function assertCanViewCourse(user, courseOrId) {
  const course = courseOrId._id ? courseOrId : await Course.findById(courseOrId);
  if (!course) throw new ApiError(404, 'Course not found');
  if (user.role === 'agent') {
    const ids = await getAgentCourseIds(user);
    if (!ids.some((id) => String(id) === String(course._id))) {
      throw new ApiError(403, 'This course is not assigned to your batch.');
    }
  }
  return course;
}

// Only the trainer who created the course (or an admin) can modify it
function assertCanEditCourse(user, course) {
  if (user.role === 'admin') return;
  if (user.role === 'trainer' && String(course.createdBy) === String(user._id)) return;
  throw new ApiError(403, 'Only the course owner or an admin can modify this course.');
}

// Agent ids a trainer handles (agents inside the trainer's batches)
async function getTrainerBatchIds(trainerId) {
  const batches = await Batch.find({ trainer: trainerId }).select('_id');
  return batches.map((b) => b._id);
}

module.exports = { getAgentCourseIds, assertCanViewCourse, assertCanEditCourse, getTrainerBatchIds };
