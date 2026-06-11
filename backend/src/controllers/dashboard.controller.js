const asyncHandler = require('../utils/asyncHandler');
const ServiceOrder = require('../models/ServiceOrder');
const Equipment = require('../models/Equipment');
const StockItem = require('../models/StockItem');
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
    estoqueAgg,
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
    // Soma a quantidade total de itens no estoque (StockItem)
    StockItem.aggregate([{ $group: { _id: null, total: { $sum: '$quantity' } } }]),
  ]);
  const totalEstoque = estoqueAgg[0]?.total || 0;

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
        totalEstoque,
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

// ====================================================================
// NOC — Painel de monitoramento (Centro de Operações de TI Educacional)
// Agrega num único endpoint: laboratórios, estoque, OS e alertas.
// ====================================================================
const { computeLabIndicators } = require('../services/labIndicators.service');
const LaboratoryModel = require('../models/Laboratory');
const StockThreshold = require('../models/StockThreshold');

exports.noc = asyncHandler(async (req, res) => {
  const user = req.user;
  const now = new Date();

  // --- Indicadores de laboratórios (reusa o cálculo do módulo) ---
  const lab = await computeLabIndicators();

  // --- Estoque ---
  const [estoqueTotalAgg, estoquePorTipo, thresholds] = await Promise.all([
    StockItem.aggregate([{ $group: { _id: null, total: { $sum: '$quantity' } } }]),
    StockItem.aggregate([
      { $group: { _id: '$type', total: { $sum: '$quantity' } } },
      { $sort: { total: -1 } },
    ]),
    StockThreshold.find().lean(),
  ]);
  const thMap = Object.fromEntries((thresholds || []).map((t) => [t.type, t.minQty]));
  const estoqueMap = Object.fromEntries(estoquePorTipo.map((x) => [x._id, x.total]));
  // Itens com estoque abaixo do mínimo configurado
  const estoqueBaixo = Object.entries(thMap)
    .filter(([type, min]) => min > 0 && (estoqueMap[type] || 0) < min)
    .map(([type, min]) => ({ type, inStock: estoqueMap[type] || 0, minQty: min }));

  // Últimas movimentações de estoque (lotes criados/atualizados recentemente)
  const ultimoEstoque = await StockItem.find()
    .sort({ updatedAt: -1 })
    .limit(6)
    .populate('createdBy', 'name')
    .lean();

  // --- Ordens de Serviço ---
  const osMatch = (extra) => scopeFilter(user, extra);
  const [osAbertas, osAndamento, osAtrasadas, osFinalizadasMes] = await Promise.all([
    ServiceOrder.countDocuments(osMatch({ status: 'aberta' })),
    ServiceOrder.countDocuments(osMatch({ status: 'em_andamento' })),
    ServiceOrder.countDocuments(withScope(user, {
      dueDate: { $lt: now },
      status: { $nin: ['finalizada', 'entregue', 'cancelada'] },
    })),
    ServiceOrder.countDocuments(withScope(user, {
      status: { $in: ['finalizada', 'entregue'] },
      closedAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) },
    })),
  ]);

  const ultimasOrdens = await ServiceOrder.find(scopeFilter(user))
    .sort({ createdAt: -1 })
    .limit(6)
    .populate('school', 'name')
    .populate('laboratory', 'name')
    .populate('technician', 'name')
    .lean();

  // --- Mapa dos laboratórios (mostra os 8 últimos montados, com mini-mapa) ---
  const labsDocs = await LaboratoryModel.find({ kind: 'laboratorio', status: { $ne: 'desativado' } })
    .select('name school status computerStatus stations assemblyDate createdAt')
    .populate('school', 'name')
    .sort({ assemblyDate: -1, createdAt: -1 })
    .limit(8)
    .lean();
  const labsMapa = labsDocs.map((l) => {
    const cs = l.computerStatus || {};
    const total = (l.stations || []).length;
    const defect = cs.defective || 0;
    const maint = cs.maintenance || 0;
    const active = cs.active || 0;
    const health = defect > 0 ? 'defeito' : maint > 0 ? 'manutencao' : 'ok';
    // status de cada estação (para desenhar os quadradinhos no card)
    const stations = (l.stations || []).map((s) => ({ code: s.code, status: s.status }));
    return {
      _id: l._id, name: l.name, school: l.school?.name || '—',
      total, active, maintenance: maint, defective: defect, health, stations,
    };
  });

  // --- Central de alertas (sintetiza tudo que precisa de atenção) ---
  const alertas = [];
  for (const l of lab.lists.preventivaDevida || []) {
    alertas.push({
      level: l.preventiveOverdue ? 'critical' : 'warning',
      icon: 'CalendarClock',
      title: `Preventiva ${l.preventiveOverdue ? 'atrasada' : 'a vencer'} — ${l.name}`,
      detail: l.school,
      link: `/laboratorios/${l._id}`,
    });
  }
  for (const l of lab.lists.comDefeito || []) {
    alertas.push({
      level: 'critical', icon: 'XCircle',
      title: `${l.defective} computador(es) com defeito — ${l.name}`,
      detail: l.school, link: `/laboratorios/${l._id}`,
    });
  }
  for (const it of estoqueBaixo) {
    alertas.push({
      level: 'warning', icon: 'PackageMinus',
      title: `Estoque baixo: ${it.type}`,
      detail: `${it.inStock} em estoque (mínimo ${it.minQty})`,
      link: '/equipamentos',
    });
  }
  if (osAtrasadas > 0) {
    alertas.push({
      level: 'warning', icon: 'Clock',
      title: `${osAtrasadas} O.S. atrasada(s)`,
      detail: 'Prazo vencido', link: '/ordens',
    });
  }
  for (const l of lab.lists.semVistoria || []) {
    alertas.push({
      level: 'info', icon: 'Eye',
      title: `Sem vistoria — ${l.name}`,
      detail: l.school, link: `/laboratorios/${l._id}`,
    });
  }

  // ordena: critical > warning > info
  const order = { critical: 0, warning: 1, info: 2 };
  alertas.sort((a, b) => order[a.level] - order[b.level]);

  res.json({
    success: true,
    data: {
      labs: {
        ativos: lab.ativos,
        comDefeito: lab.comDefeito,
        semVistoria: lab.semVistoria,
        manutencaoPendente: lab.manutencaoPendente,
        preventivaDevida: lab.preventivaDevida,
        mapa: labsMapa,
        listaDefeito: lab.lists.comDefeito || [],
        listaPreventiva: lab.lists.preventivaDevida || [],
      },
      estoque: {
        total: estoqueTotalAgg[0]?.total || 0,
        porTipo: estoquePorTipo,
        baixo: estoqueBaixo,
        ultimos: ultimoEstoque,
      },
      os: {
        abertas: osAbertas,
        emAndamento: osAndamento,
        atrasadas: osAtrasadas,
        finalizadasMes: osFinalizadasMes,
        ultimas: ultimasOrdens,
      },
      alertas,
    },
  });
});
