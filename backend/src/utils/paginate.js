/**
 * Helper de paginação para queries Mongoose.
 * Lê page, limit, sort, order de req.query.
 */
function getPagination(query) {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '10', 10), 1), 100);
  const skip = (page - 1) * limit;
  const sortField = query.sort || 'createdAt';
  const order = query.order === 'asc' ? 1 : -1;
  return { page, limit, skip, sort: { [sortField]: order } };
}

async function paginate(model, filter = {}, options = {}, populate = []) {
  const { page, limit, skip, sort } = options;
  const [items, total] = await Promise.all([
    populate.length
      ? model.find(filter).sort(sort).skip(skip).limit(limit).populate(populate)
      : model.find(filter).sort(sort).skip(skip).limit(limit),
    model.countDocuments(filter),
  ]);
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

module.exports = { getPagination, paginate };
