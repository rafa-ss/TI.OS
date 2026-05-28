const asyncHandler = require('../utils/asyncHandler');
const StockItem = require('../models/StockItem');
const AppError = require('../utils/AppError');
const { getPagination, paginate } = require('../utils/paginate');

exports.list = asyncHandler(async (req, res) => {
  const { q, type, condition } = req.query;
  const filter = {};
  if (q) filter.$or = [
    { location: new RegExp(q, 'i') },
    { notes: new RegExp(q, 'i') },
  ];
  if (type) filter.type = type;
  if (condition) filter.condition = condition;

  const pagination = getPagination(req.query);
  const data = await paginate(StockItem, filter, pagination);
  res.json({ success: true, ...data });
});

exports.create = asyncHandler(async (req, res) => {
  const payload = { ...req.body, createdBy: req.user._id };
  const item = await StockItem.create(payload);
  res.status(201).json({ success: true, item });
});

exports.update = asyncHandler(async (req, res) => {
  const item = await StockItem.findById(req.params.id);
  if (!item) throw new AppError('Item não encontrado', 404);
  Object.assign(item, req.body);
  await item.save();
  res.json({ success: true, item });
});

exports.remove = asyncHandler(async (req, res) => {
  const item = await StockItem.findByIdAndDelete(req.params.id);
  if (!item) throw new AppError('Item não encontrado', 404);
  res.json({ success: true });
});

exports.summary = asyncHandler(async (_req, res) => {
  const [totalAgg, byType, byCondition] = await Promise.all([
    StockItem.aggregate([{ $group: { _id: null, total: { $sum: '$quantity' } } }]),
    StockItem.aggregate([
      { $group: { _id: '$type', total: { $sum: '$quantity' } } },
      { $sort: { total: -1 } },
    ]),
    StockItem.aggregate([
      { $group: { _id: '$condition', total: { $sum: '$quantity' } } },
    ]),
  ]);
  res.json({
    success: true,
    data: {
      total: totalAgg[0]?.total || 0,
      byType,
      byCondition,
    },
  });
});