const asyncHandler = require('../utils/asyncHandler');
const ServiceOrder = require('../models/ServiceOrder');
const Equipment = require('../models/Equipment');
const School = require('../models/School');
const User = require('../models/User');

/**
 * Para o técnico, restringe o universo de O.S. ao que ele consegue ver:
 *  - status "aberta" (livres pra pegar)
 *  - ou onde ele é o técnico atribuído
 * Admin e atendente veem tudo.
 */
function scopeFilter(user, base = {}) {
  if (user.role === 'tecnico') {
    return {
      ...base,
      $or: [
        { status: 'aberta' },
        { technician: user._id },
      ],
    };
  }
  return base;
}

/**
 * Combina o filtro de escopo com outro filtro que já tem $or
 * (usa $and para preservar os dois).
 */
function withScope(user, extra = {}) {
  if (user.role !== 'tecnico') return extra;
  const scope = { $or: [{ status: 'aberta' }, { technician: user._id }] };
  if (extra.$or) {
    return { $and: [{ $or: extra.$or }, scope] };
  }
  return { ...extra, ...scope };
}

exports.summary = asyncHandler(async (req, res) => {
  const user = req.user;
  const now = new Date();

  const [
    abertas,
    emAndamento,
    aguardandoPeca,
    finalizadas,
    entregues,
    canceladas,
    atrasadas,
    totalEquipamentos,
    totalEscolas,
    totalTecnicos,
  ] = await Promise.all([
    ServiceOrder.countDocuments(scopeFilter(user, { status: 'aberta' })),
    ServiceOrder.countDocuments(scopeFilter(user, { status: 'em_andamento' })),
    ServiceOrder.countDocuments(scopeFilter(user, { status: 'aguardando_peca' })),
    ServiceOrder.countDocuments(scopeFilter(user, { status: 'finalizada' })),
    ServiceOrder.countDocuments(scopeFilter(user, { status: 'entregue' })),
    ServiceOrder.countDocuments(scopeFilter(user, { status: 'cancelada' })),
    ServiceOrder.countDocuments(withScope(user, {
      dueDate: { $lt: now },
      status: { $nin: ['finalizada', 'entregue', 'cancelada'] },
    })),
    Equipment.countDocuments(),
    School.countDocuments(),
    User.countDocuments({ role: 'tecnico', active: true }),
  ]);

  const matchStage = user.role === 'tecnico'
    ? { $or: [{ status: 'aberta' }, { technician: user._id }] }
    : {};

  const byPriority = await ServiceOrder.aggregate([
    ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
    { $group: { _id: '$priority', count: { $sum: 1 } } },
  ]);

  // últimos 12 meses
  const start = new Date();
  start.setMonth(start.getMonth() - 11);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const monthlyMatch = user.role === 'tecnico'
    ? {
        openedAt: { $gte: start },
        $or: [{ status: 'aberta' }, { technician: user._id }],
      }
    : { openedAt: { $gte: start } };

  const monthly = await ServiceOrder.aggregate([
    { $match: monthlyMatch },
    {
      $group: {
        _id: { y: { $year: '$openedAt' }, m: { $month: '$openedAt' } },
        abertas: { $sum: 1 },
        finalizadas: {
          $sum: { $cond: [{ $in: ['$status', ['finalizada', 'entregue']] }, 1, 0] },
        },
      },
    },
    { $sort: { '_id.y': 1, '_id.m': 1 } },
  ]);

  const productivity = await ServiceOrder.aggregate([
    { $match: { technician: { $ne: null } } },
    {
      $group: {
        _id: '$technician',
        total: { $sum: 1 },
        finalizadas: {
          $sum: { $cond: [{ $in: ['$status', ['finalizada', 'entregue']] }, 1, 0] },
        },
      },
    },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'tech' } },
    { $unwind: { path: '$tech', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, technician: '$tech.name', total: 1, finalizadas: 1 } },
    { $sort: { finalizadas: -1 } },
    { $limit: 10 },
  ]);

  const recentOrders = await ServiceOrder.find(scopeFilter(user))
    .sort({ createdAt: -1 })
    .limit(8)
    .populate('school', 'name')
    .populate('technician', 'name')
    .lean();

  res.json({
    success: true,
    data: {
      counters: {
        abertas,
        emAndamento,
        aguardandoPeca,
        finalizadas,
        entregues,
        canceladas,
        atrasadas,
        totalEquipamentos,
        totalEscolas,
        totalTecnicos,
        totalAtivas: abertas + emAndamento + aguardandoPeca,
      },
      byPriority,
      monthly,
      productivity,
      recentOrders,
    },
  });
});
