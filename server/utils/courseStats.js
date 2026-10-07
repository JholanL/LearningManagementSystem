// Counts documents of a model per course. Returns a Map of courseId string -> count.
exports.countByCourse = async (Model, courseIds) => {
  const rows = await Model.aggregate([
    { $match: { course: { $in: courseIds } } },
    { $group: { _id: '$course', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
};

exports.toProgress = (completed, total) => {
  const done = Math.min(completed, total);
  return {
    completed: done,
    total,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
};
