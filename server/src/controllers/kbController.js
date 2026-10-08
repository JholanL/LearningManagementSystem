const KbArticle = require('../models/KbArticle');
const KbFeedback = require('../models/KbFeedback');
const Course = require('../models/Course');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');
const { paginate, searchFilter } = require('../utils/query');
const { getAgentCourseIds } = require('../services/accessService');
const { audit } = require('../services/auditService');

const FIELDS = ['title', 'category', 'tags', 'summary', 'body', 'account', 'status', 'relatedCourses'];

const slugify = (text = '') =>
  String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'article';

// Generate a unique slug, adding -2, -3, ... on clashes.
async function uniqueSlug(title) {
  const base = slugify(title);
  let slug = base;
  let n = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await KbArticle.exists({ slug })) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

// Related courses the user is actually allowed to see.
async function visibleRelatedCourses(user, relatedCourseIds = []) {
  if (!relatedCourseIds.length) return [];
  const filter = { _id: { $in: relatedCourseIds } };
  if (user.role === 'agent') {
    const allowed = (await getAgentCourseIds(user)).map(String);
    filter._id = { $in: relatedCourseIds.filter((id) => allowed.includes(String(id))) };
  }
  return Course.find(filter).select('code title isPublished');
}

// GET /api/kb?search=&category=&tag=&page=&limit=   (agents: published only)
exports.getArticles = asyncHandler(async (req, res) => {
  const { search, category, tag } = req.query;
  const filter = { ...searchFilter(search, ['title', 'summary', 'tags', 'body']) };
  if (category) filter.category = category;
  if (tag) filter.tags = String(tag).toLowerCase();
  if (req.user.role === 'agent') filter.status = 'published';
  else if (req.query.status) filter.status = req.query.status;

  const result = await paginate(KbArticle, filter, req.query, {
    select: '-body', // list shows the summary, not the full body
    populate: { path: 'author', select: 'firstName lastName' },
  });
  res.json({ success: true, ...result });
});

// GET /api/kb/popular   top 5 published articles by views
exports.getPopular = asyncHandler(async (_req, res) => {
  const data = await KbArticle.find({ status: 'published' }).sort('-views').limit(5).select('title slug category summary views');
  res.json({ success: true, data });
});

// GET /api/kb/:slug   increments views; includes vote counts, my vote, related courses
exports.getArticle = asyncHandler(async (req, res) => {
  const article = await KbArticle.findOne({ slug: req.params.slug }).populate('author', 'firstName lastName');
  if (!article) throw new ApiError(404, 'Article not found');
  if (req.user.role === 'agent' && article.status !== 'published') throw new ApiError(404, 'Article not found');

  // Count the view only when the user is actually allowed to read it.
  await KbArticle.updateOne({ _id: article._id }, { $inc: { views: 1 } });
  article.views += 1;

  const [helpfulYes, helpfulNo, myVote, related] = await Promise.all([
    KbFeedback.countDocuments({ article: article._id, helpful: true }),
    KbFeedback.countDocuments({ article: article._id, helpful: false }),
    KbFeedback.findOne({ article: article._id, user: req.user._id }).select('helpful'),
    visibleRelatedCourses(req.user, article.relatedCourses),
  ]);

  res.json({
    success: true,
    data: {
      ...article.toObject(),
      relatedCourses: related,
      helpfulYes,
      helpfulNo,
      myVote: myVote ? myVote.helpful : null,
    },
  });
});

// POST /api/kb   (admin, trainer)
exports.createArticle = asyncHandler(async (req, res) => {
  const data = pick(req.body, FIELDS);
  data.slug = await uniqueSlug(data.title);
  data.author = req.user._id;
  data.updatedBy = req.user._id;
  const article = await KbArticle.create(data);
  res.status(201).json({ success: true, message: 'Article created.', data: article });
});

// Load an article and enforce edit ownership (admin any; trainer must be the author).
async function loadEditable(user, id) {
  const article = await KbArticle.findById(id);
  if (!article) throw new ApiError(404, 'Article not found');
  if (user.role !== 'admin' && String(article.author) !== String(user._id)) {
    throw new ApiError(403, 'You can only edit articles you authored.');
  }
  return article;
}

// PUT /api/kb/:id   (admin, or the trainer who authored it)
exports.updateArticle = asyncHandler(async (req, res) => {
  const article = await loadEditable(req.user, req.params.id);
  Object.assign(article, pick(req.body, FIELDS));
  article.updatedBy = req.user._id;
  await article.save();
  res.json({ success: true, message: 'Article updated.', data: article });
});

// PATCH /api/kb/:id/publish   (admin, trainer) - toggle
exports.togglePublish = asyncHandler(async (req, res) => {
  const article = await loadEditable(req.user, req.params.id);
  article.status = article.status === 'published' ? 'draft' : 'published';
  article.updatedBy = req.user._id;
  await article.save();
  await audit(req, {
    action: 'kb.publish',
    targetType: 'KbArticle',
    targetId: article._id,
    targetLabel: article.title,
    metadata: { status: article.status },
  });
  res.json({ success: true, message: article.status === 'published' ? 'Article published.' : 'Article unpublished.', data: article });
});

// DELETE /api/kb/:id   (admin) - audit logged
exports.deleteArticle = asyncHandler(async (req, res) => {
  const article = await KbArticle.findById(req.params.id);
  if (!article) throw new ApiError(404, 'Article not found');
  const label = article.title;
  const deletedId = article._id;
  await KbFeedback.deleteMany({ article: article._id });
  await article.deleteOne();
  await audit(req, { action: 'kb.delete', targetType: 'KbArticle', targetId: deletedId, targetLabel: label });
  res.json({ success: true, message: 'Article deleted.' });
});

// POST /api/kb/:id/feedback   { helpful } - upsert one vote per user
exports.feedback = asyncHandler(async (req, res) => {
  const article = await KbArticle.findById(req.params.id).select('status');
  if (!article) throw new ApiError(404, 'Article not found');
  if (req.user.role === 'agent' && article.status !== 'published') throw new ApiError(404, 'Article not found');

  await KbFeedback.findOneAndUpdate(
    { article: article._id, user: req.user._id },
    { $set: { helpful: !!req.body.helpful } },
    { upsert: true, new: true }
  );

  const [helpfulYes, helpfulNo] = await Promise.all([
    KbFeedback.countDocuments({ article: article._id, helpful: true }),
    KbFeedback.countDocuments({ article: article._id, helpful: false }),
  ]);
  res.json({ success: true, message: 'Thanks for the feedback.', data: { helpfulYes, helpfulNo, myVote: !!req.body.helpful } });
});
