/**
 * Serviço de análise gerencial para a página de Relatórios.
 * Gera KPIs e séries para gráficos (recharts) a partir das Ordens de Serviço,
 * Escolas, Laboratórios e Usuários. Tudo respeitando os filtros enviados.
 */
const mongoose = require('mongoose');
const ServiceOrder = require('../models/ServiceOrder');
const School = require('../models/School');
const Laboratory = require('../models/Laboratory');
const User = require('../models/User');

const FINISHED = ['finalizada', 'entregue'];
const PENDING = ['aberta', 'em_andamento', 'aguardando_peca'];

function oid(v) {
  try { return new mongoose.Types.ObjectId(v); } catch { return null; }
}

/** Monta o $match das O.S. a partir dos filtros da query. */
function buildOrderMatch(f = {}) {
  const match = {};
  if (f.from || f.to) {
    match.openedAt = {};
    if (f.from) match.openedAt.$gte = new Date(f.from);
    if (f.to) match.openedAt.$lte = new Date(f.to + 'T23:59:59');
  }
  if (f.technician && oid(f.technician)) match.technician = oid(f.technician);
  if (f.school && oid(f.school)) match.school = oid(f.school);
  if (f.laboratory && oid(f.laboratory)) match.laboratory = oid(f.laboratory);
  if (f.status) match.status = f.status;
  if (f.serviceType) match.serviceType = f.serviceType;
  return match;
}

/** Diferença em horas entre abertura e conclusão (quando houver). */
const AVG_HOURS_EXPR = {
  $divide: [{ $subtract: ['$closedAt', '$openedAt'] }, 1000 * 60 * 60],
};

async function computeAnalytics(filters = {}) {
  const match = buildOrderMatch(filters);

  const [
    kpiAgg,
    byStatus,
    byType,
    byMonth,
    byWeek,
    byTechnician,
    bySchool,
    byLab,
    avgTimeAgg,
    totalTecnicos,
    totalEscolas,
    totalLabs,
  ] = await Promise.all([
    // KPIs gerais (sobre o conjunto filtrado)
    ServiceOrder.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          finalizadas: { $sum: { $cond: [{ $in: ['$status', FINISHED] }, 1, 0] } },
          pendentes: { $sum: { $cond: [{ $in: ['$status', PENDING] }, 1, 0] } },
          canceladas: { $sum: { $cond: [{ $eq: ['$status', 'cancelada'] }, 1, 0] } },
        },
      },
    ]),

    // Status das O.S. (para pizza/rosca)
    ServiceOrder.aggregate([
      { $match: match },
      { $group: { _id: '$status', value: { $sum: 1 } } },
      { $sort: { value: -1 } },
    ]),

    // Quantidade por tipo de serviço (barras horizontais)
    ServiceOrder.aggregate([
      { $match: match },
      { $group: { _id: '$serviceType', value: { $sum: 1 } } },
      { $sort: { value: -1 } },
    ]),

    // O.S. por mês (linha)
    ServiceOrder.aggregate([
      { $match: match },
      {
        $group: {
          _id: { y: { $year: '$openedAt' }, m: { $month: '$openedAt' } },
          value: { $sum: 1 },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]),

    // O.S. por semana ISO (linha/barra)
    ServiceOrder.aggregate([
      { $match: match },
      {
        $group: {
          _id: { y: { $isoWeekYear: '$openedAt' }, w: { $isoWeek: '$openedAt' } },
          value: { $sum: 1 },
        },
      },
      { $sort: { '_id.y': 1, '_id.w': 1 } },
      { $limit: 26 },
    ]),

    // Ranking de técnicos
    ServiceOrder.aggregate([
      { $match: { ...match, technician: { $ne: null } } },
      {
        $group: {
          _id: '$technician',
          total: { $sum: 1 },
          finalizadas: { $sum: { $cond: [{ $in: ['$status', FINISHED] }, 1, 0] } },
        },
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'tech' } },
      { $unwind: { path: '$tech', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, name: '$tech.name', total: 1, finalizadas: 1 } },
      { $sort: { finalizadas: -1, total: -1 } },
      { $limit: 15 },
    ]),

    // Escolas mais atendidas
    ServiceOrder.aggregate([
      { $match: { ...match, school: { $ne: null } } },
      { $group: { _id: '$school', total: { $sum: 1 } } },
      { $lookup: { from: 'schools', localField: '_id', foreignField: '_id', as: 'school' } },
      { $unwind: { path: '$school', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, name: '$school.name', inep: '$school.inep', total: 1 } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]),

    // Laboratórios com mais chamados
    ServiceOrder.aggregate([
      { $match: { ...match, laboratory: { $ne: null } } },
      { $group: { _id: '$laboratory', total: { $sum: 1 } } },
      { $lookup: { from: 'laboratories', localField: '_id', foreignField: '_id', as: 'lab' } },
      { $unwind: { path: '$lab', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, name: '$lab.name', total: 1 } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]),

    // Tempo médio de atendimento (horas) das O.S. concluídas
    ServiceOrder.aggregate([
      { $match: { ...match, status: { $in: FINISHED }, closedAt: { $ne: null } } },
      { $group: { _id: null, avgHours: { $avg: AVG_HOURS_EXPR } } },
    ]),

    User.countDocuments({ role: { $in: ['admin', 'tecnico'] }, active: true }),
    School.countDocuments(),
    Laboratory.countDocuments({ kind: 'laboratorio', status: { $ne: 'desativado' } }),
  ]);

  const k = kpiAgg[0] || { total: 0, finalizadas: 0, pendentes: 0, canceladas: 0 };

  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return {
    kpis: {
      totalOrders: k.total,
      finalizadas: k.finalizadas,
      pendentes: k.pendentes,
      canceladas: k.canceladas,
      totalTecnicos,
      totalEscolas,
      totalLabs,
      avgHours: avgTimeAgg[0]?.avgHours ? Math.round(avgTimeAgg[0].avgHours * 10) / 10 : 0,
    },
    byStatus: byStatus.map((s) => ({ status: s._id, value: s.value })),
    byType: byType.map((t) => ({ type: t._id, value: t.value })),
    byMonth: byMonth.map((m) => ({
      label: `${MESES[(m._id.m || 1) - 1]}/${String(m._id.y).slice(2)}`,
      value: m.value,
    })),
    byWeek: byWeek.map((w) => ({ label: `S${w._id.w}/${String(w._id.y).slice(2)}`, value: w.value })),
    byTechnician,
    bySchool,
    byLab,
  };
}

/** Histórico paginado de O.S. (Seção 5). */
async function ordersHistory(filters = {}, page = 1, limit = 15) {
  const match = buildOrderMatch(filters);
  const skip = (Math.max(1, page) - 1) * limit;

  const [items, total] = await Promise.all([
    ServiceOrder.find(match)
      .populate('technician', 'name')
      .populate('school', 'name')
      .populate('laboratory', 'name')
      .sort({ openedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('number openedAt closedAt technician school laboratory serviceType status')
      .lean(),
    ServiceOrder.countDocuments(match),
  ]);

  const rows = items.map((o) => {
    let hours = null;
    if (o.closedAt && o.openedAt) {
      hours = Math.round(((new Date(o.closedAt) - new Date(o.openedAt)) / 36e5) * 10) / 10;
    }
    return {
      _id: o._id,
      number: o.number,
      openedAt: o.openedAt,
      technician: o.technician?.name || null,
      school: o.school?.name || null,
      laboratory: o.laboratory?.name || null,
      serviceType: o.serviceType,
      status: o.status,
      hours,
    };
  });

  return { items: rows, total, page: Math.max(1, page), totalPages: Math.ceil(total / limit) || 1 };
}

module.exports = { computeAnalytics, ordersHistory };
