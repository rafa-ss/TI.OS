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

    const normalizeType = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_');

  // Normaliza o tipo (minúsculo, sem espaços extras) para casar com lote existente
  const type = normalizeType(payload.type);
  const condition = payload.condition || 'novo';
  const location = (payload.location || 'Coordenação de tecnologia educacional').trim();
  const addQty = Math.max(1, Number(payload.quantity) || 1);

  // === MERGE: se já existir lote com mesmo tipo + condição + local, soma ===
  const existing = await StockItem.findOne({ type, condition, location });

  if (existing) {
    existing.quantity = (existing.quantity || 0) + addQty;
    // Se vier notes nova, concatena (não sobrescreve a antiga)
    if (payload.notes && payload.notes.trim() &&
        !(existing.notes || '').includes(payload.notes.trim())) {
      existing.notes = [existing.notes, payload.notes].filter(Boolean).join(' | ');
    }
    await existing.save();
    return res.status(200).json({
      success: true,
      item: existing,
      merged: true,
      message: `+${addQty} unidade(s) adicionada(s) ao lote existente (total: ${existing.quantity})`,
    });
  }

  // Senão, cria um lote novo
  const item = await StockItem.create({ ...payload, type, condition, location, quantity: addQty });
  res.status(201).json({ success: true, item, merged: false });
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

/**
 * Resumo geral: totais por tipo e condição.
 */
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

/**
 * Retorna os tipos disponíveis pra usar no formulário:
 *  - os padrões do model (TYPES)
 *  - + os tipos customizados que o usuário já cadastrou no banco
 * Lista única, ordenada alfabeticamente.
 */
exports.types = asyncHandler(async (_req, res) => {
  const padrao = StockItem.TYPES || [];
  const distintos = await StockItem.distinct('type');
  const set = new Set([...padrao, ...distintos.filter(Boolean)]);
  const items = Array.from(set).sort();
  res.json({ success: true, items });
});
