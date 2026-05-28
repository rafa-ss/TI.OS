const asyncHandler = require('../utils/asyncHandler');
const StockThreshold = require('../models/StockThreshold');

exports.list = asyncHandler(async (_req, res) => {
  const items = await StockThreshold.find().sort({ type: 1 });
  res.json({ success: true, items });
});

exports.upsert = asyncHandler(async (req, res) => {
  const { type, minQty, note } = req.body;
  if (!type) return res.status(400).json({ success: false, message: 'type é obrigatório' });
  const item = await StockThreshold.findOneAndUpdate(
    { type },
    { type, minQty: Number(minQty) || 0, note: note || '', updatedBy: req.user._id },
    { upsert: true, new: true }
  );
  res.json({ success: true, item });
});

exports.remove = asyncHandler(async (req, res) => {
  await StockThreshold.findOneAndDelete({ type: req.params.type });
  res.json({ success: true });
});
