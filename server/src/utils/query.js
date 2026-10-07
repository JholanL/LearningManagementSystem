// Helpers for search + pagination used by every list endpoint.

// Escape user input before using it in a RegExp (prevents ReDoS / regex injection).
const escapeRegex = (text = '') => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Builds { $or: [{field: /search/i}, ...] } for a search term.
const searchFilter = (search, fields) => {
  if (!search || !String(search).trim()) return {};
  const regex = new RegExp(escapeRegex(String(search).trim()), 'i');
  return { $or: fields.map((f) => ({ [f]: regex })) };
};

// Reads ?page=&limit= safely (limit capped at 100).
const getPagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

// Runs a paginated find and returns a consistent response shape:
// { data: [...], pagination: { page, limit, total, totalPages } }
const paginate = async (Model, filter, query, { sort = '-createdAt', populate, select } = {}) => {
  const { page, limit, skip } = getPagination(query);
  let q = Model.find(filter).sort(sort).skip(skip).limit(limit);
  if (populate) q = q.populate(populate);
  if (select) q = q.select(select);
  const [data, total] = await Promise.all([q, Model.countDocuments(filter)]);
  return {
    data,
    pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  };
};

module.exports = { escapeRegex, searchFilter, getPagination, paginate };
