const asyncHandler = require('../utils/asyncHandler');
const Laboratory = require('../models/Laboratory');
const School = require('../models/School');
const StockItem = require('../models/StockItem');
const AppError = require('../utils/AppError');
const { getPagination, paginate } = require('../utils/paginate');
const labService = require('../services/laboratory.service');
const stationService = require('../services/station.service');
const kitService = require('../services/kit.service');
const termService = require('../services/labDeliveryTerm.service');
const { generateTermNumber } = require('../services/termNumber.service');
const { computeLabIndicators, computePreventiveSchedule } = require('../services/labIndicators.service');

const populateRefs = [
  { path: 'school', select: 'name inep municipio' },
  { path: 'responsibleTech', select: 'name email role' },
  { path: 'responsibles', select: 'name email role' },
  { path: 'createdBy', select: 'name' },
  { path: 'history.user', select: 'name' },
];

exports.list = asyncHandler(async (req, res) => {
  const { q, status, school, kind } = req.query;
  const filter = {};

  if (q) {
    const rx = new RegExp(q.trim(), 'i');
    // Acha as escolas cujo NOME ou INEP batem com o termo, para incluir os
    // laboratórios/setores ligados a elas no resultado da busca.
    const matchedSchools = await School.find({
      $or: [{ name: rx }, { inep: rx }],
    }).select('_id').lean();
    const schoolIds = matchedSchools.map((s) => s._id);

    // Busca por nome do laboratório/setor OU pela escola (nome/INEP).
    filter.$or = [{ name: rx }];
    if (schoolIds.length) filter.$or.push({ school: { $in: schoolIds } });
  }

  if (status) filter.status = status;
  if (school) filter.school = school;
  if (kind) filter.kind = kind; // 'laboratorio' | 'administrativo'

  // Ordem alfabética por nome (padrão). Sobrescrevível via ?sort=&order=.
  const pagination = getPagination({ sort: 'name', order: 'asc', ...req.query });
  const data = await paginate(Laboratory, filter, pagination, populateRefs);
  res.json({ success: true, ...data });
});

exports.get = asyncHandler(async (req, res) => {
  const lab = await Laboratory.findById(req.params.id).populate(populateRefs);
  if (!lab) throw new AppError('Laboratório não encontrado', 404);

  // Calcula dinamicamente a agenda de preventiva (aniversário da montagem).
  // Assim a "Próx. preventiva" aparece mesmo em labs que nunca tiveram uma
  // OS preventiva finalizada (quando nextPreventiveAt ainda não foi gravado).
  const obj = lab.toObject({ virtuals: true });
  if (lab.kind === 'laboratorio') {
    const baseDate = lab.assemblyDate || lab.createdAt;
    const prev = computePreventiveSchedule(baseDate, lab.lastInspectionAt);
    // Usa a data calculada como fallback, mantendo a gravada se houver e for futura.
    obj.nextPreventiveAt = lab.nextPreventiveAt || prev.nextDue;
    obj.preventiveDue = prev.due;
    obj.preventiveOverdue = prev.overdue;
    obj.daysToPreventive = prev.daysTo;
  }

  res.json({ success: true, laboratory: obj });
});

exports.create = asyncHandler(async (req, res) => {
  const { name, school, equipments = [], kits = [], responsibleTech, responsibles, status, assemblyDate, notes, kind } = req.body;
  if (!name) throw new AppError('Informe o nome do espaço', 400);
  if (!school) throw new AppError('Selecione a escola', 400);
  const kindNorm = (kind === 'administrativo') ? 'administrativo' : 'laboratorio';

  // Itens avulsos enviados diretamente
  const avulsos = (equipments || []).map(e => ({
    type: String(e.type || '').toLowerCase().trim(),
    condition: e.condition || 'novo',
    quantity: Number(e.quantity) || 0,
  })).filter(e => e.type && e.quantity > 0);

  // Kits → explode em componentes individuais
  const { components: kitComponents, snapshots: kitSnapshots } = await kitService.expandKits(kits);

  // Inventário real = avulsos + componentes de kits (agregado por tipo/condição)
  const normEqs = kitService.mergeComponents(avulsos, kitComponents);

  if (normEqs.length > 0) {
    await kitService.ensureStock(normEqs, 'Estoque insuficiente para montar este laboratório');
    await labService.debitStock(normEqs);
  }

  const totalKits = kitSnapshots.reduce((a, k) => a + k.quantity, 0);

  // Numeração do Termo de Entrega: 100% automática (NN/AAAA), gerada no backend
  // na criação. Atômica e anti-duplicidade (ver termNumber.service).
  const deliveryTermNumber = await generateTermNumber();

  const notaCriacao = [
    `${kindNorm === 'administrativo' ? 'Setor Administrativo' : 'Laboratório'} criado com ${normEqs.reduce((a, e) => a + e.quantity, 0)} equipamento(s)`,
    totalKits > 0 ? `(${totalKits} kit(s): ${kitSnapshots.map(k => `${k.quantity}× ${k.name}`).join(', ')})` : '',
    `· Termo de Entrega nº ${deliveryTermNumber}`,
  ].filter(Boolean).join(' ');

  const lab = await Laboratory.create({
    name,
    kind: kindNorm,
    school,
    responsibleTech: responsibleTech || undefined,
    responsibles: Array.isArray(responsibles) ? responsibles.filter(Boolean) : [],
    status: status || 'planejado',
    assemblyDate: assemblyDate || undefined,
    notes: notes || '',
    equipments: normEqs,
    kits: kitSnapshots,
    deliveryTermNumber,
    createdBy: req.user._id,
    history: [{
      user: req.user._id,
      action: 'criado',
      note: notaCriacao,
    }],
  });

  // Gera as estações automaticamente conforme a qtd de computadores
  if (kindNorm === 'laboratorio') {
    stationService.syncStations(lab);
    await lab.save();
  }

  const populated = await Laboratory.findById(lab._id).populate(populateRefs);
  res.status(201).json({ success: true, laboratory: populated });
});

exports.update = asyncHandler(async (req, res) => {
  const lab = await Laboratory.findById(req.params.id);
  if (!lab) throw new AppError('Laboratório não encontrado', 404);

  const { equipments, kits, ...rest } = req.body;

  // Normaliza kind se vier
  if (Object.prototype.hasOwnProperty.call(rest, 'kind')) {
    rest.kind = (rest.kind === 'administrativo') ? 'administrativo' : 'laboratorio';
  }

  const oldStatus = lab.status;

  // Edição de equipamentos e/ou kits (apenas ADMIN pode incluir/excluir/alterar)
  const editingInventory = Array.isArray(equipments) || Array.isArray(kits);
  if (editingInventory) {
    if (req.user.role !== 'admin') {
      throw new AppError(
        'Apenas administradores podem alterar a lista de equipamentos do laboratório',
        403
      );
    }
    if (lab.returnedToStock) {
      throw new AppError('Laboratório já desativado — não é possível alterar equipamentos', 400);
    }

    // Se um dos dois não veio, mantém o que já existe no laboratório.
    const avulsos = (Array.isArray(equipments) ? equipments : []).map(e => ({
      type: String(e.type || '').toLowerCase().trim(),
      condition: e.condition || 'novo',
      quantity: Number(e.quantity) || 0,
    })).filter(e => e.type && e.quantity > 0);

    // Kits: se enviados, explode; senão, reaproveita o snapshot atual do lab.
    let kitSnapshots;
    let kitComponents;
    if (Array.isArray(kits)) {
      const expanded = await kitService.expandKits(kits);
      kitSnapshots = expanded.snapshots;
      kitComponents = expanded.components;
    } else {
      kitSnapshots = (lab.kits || []).map(k => k.toObject ? k.toObject() : k);
      kitComponents = kitService.mergeComponents(
        ...(lab.kits || []).map(k => k.components || [])
      );
    }

    // Se equipments não veio, preserva os itens avulsos atuais
    // (inventário atual menos o que veio de kits antigos).
    let avulsosFinais = avulsos;
    if (!Array.isArray(equipments)) {
      const oldKitComponents = kitService.mergeComponents(
        ...(lab.kits || []).map(k => k.components || [])
      );
      // avulsos atuais = inventário atual - componentes dos kits antigos
      const invMap = new Map();
      for (const e of lab.equipments || []) {
        invMap.set(`${e.type}|${e.condition}`, (invMap.get(`${e.type}|${e.condition}`) || 0) + e.quantity);
      }
      for (const c of oldKitComponents) {
        const k = `${c.type}|${c.condition}`;
        invMap.set(k, (invMap.get(k) || 0) - c.quantity);
      }
      avulsosFinais = Array.from(invMap.entries())
        .map(([key, quantity]) => {
          const [type, condition] = key.split('|');
          return { type, condition, quantity };
        })
        .filter(e => e.quantity > 0);
    }

    // Inventário real final = avulsos + componentes dos kits
    const normEqs = kitService.mergeComponents(avulsosFinais, kitComponents);

    const { toDebit, toReturn } = labService.diffEquipments(lab.equipments, normEqs);

    if (toDebit.length > 0) {
      const check = await labService.checkAvailability(toDebit);
      if (!check.ok) {
        throw new AppError(
          'Estoque insuficiente para incluir os equipamentos solicitados',
          400,
          check.missing
        );
      }
    }

    if (toReturn.length > 0) {
      await labService.returnToStock(
        toReturn,
        StockItem.DEFAULT_LOCATION,
        `Edição do laboratório "${lab.name}" — equipamentos devolvidos pelo admin`
      );
    }
    if (toDebit.length > 0) {
      await labService.debitStock(toDebit);
    }

    lab.equipments = normEqs;
    lab.kits = kitSnapshots;

    // Re-sincroniza as estações com a nova quantidade de computadores
    stationService.syncStations(lab);

    if (toDebit.length > 0 || toReturn.length > 0) {
      const partes = [];
      if (toDebit.length) {
        partes.push(`+${toDebit.reduce((a, e) => a + e.quantity, 0)} retirado(s) do estoque`);
      }
      if (toReturn.length) {
        partes.push(`${toReturn.reduce((a, e) => a + e.quantity, 0)} devolvido(s) ao estoque`);
      }
      lab.history.push({
        user: req.user._id,
        action: 'equipamentos_alterados',
        note: partes.join(' · '),
      });
    }
  }

  // O número do Termo de Entrega é 100% automático e imutável: nunca pode ser
  // definido/alterado manualmente pelo cliente. Ignoramos qualquer tentativa.
  if (Object.prototype.hasOwnProperty.call(rest, 'deliveryTermNumber')) {
    delete rest.deliveryTermNumber;
  }

  // Rede de segurança: se por algum motivo um lab antigo estiver sem número,
  // gera automaticamente agora (nunca deixa termo sem numeração).
  if (!lab.deliveryTermNumber) {
    lab.deliveryTermNumber = await generateTermNumber();
    lab.history.push({
      user: req.user._id,
      action: 'termo_gerado',
      note: `Nº do termo de entrega gerado automaticamente: ${lab.deliveryTermNumber}`,
    });
  }

  Object.assign(lab, rest);

  if (rest.status && rest.status !== oldStatus) {
    lab.history.push({
      user: req.user._id, action: 'status_alterado',
      note: `${oldStatus} → ${rest.status}`,
    });
    if (rest.status === 'concluido' && !lab.completionDate) {
      lab.completionDate = new Date();
    }
  }

  await lab.save();
  const populated = await Laboratory.findById(lab._id).populate(populateRefs);
  res.json({ success: true, laboratory: populated });
});

exports.remove = asyncHandler(async (req, res) => {
  const lab = await Laboratory.findById(req.params.id);
  if (!lab) throw new AppError('Laboratório não encontrado', 404);

  if (!lab.returnedToStock && lab.equipments.length > 0) {
    await labService.returnToStock(
      lab.equipments,
      StockItem.DEFAULT_LOCATION,
      `Devolução por exclusão do laboratório: ${lab.name}`
    );
  }

  await lab.deleteOne();
  res.json({ success: true, message: 'Laboratório removido e equipamentos devolvidos ao estoque' });
});

exports.deactivate = asyncHandler(async (req, res) => {
  const lab = await Laboratory.findById(req.params.id);
  if (!lab) throw new AppError('Laboratório não encontrado', 404);
  if (lab.returnedToStock) {
    throw new AppError('Equipamentos já foram devolvidos ao estoque', 400);
  }

  if (lab.equipments.length > 0) {
    await labService.returnToStock(
      lab.equipments,
      StockItem.DEFAULT_LOCATION,
      `Retorno do laboratório "${lab.name}" - ${req.body.note || 'desativado'}`
    );
  }

  lab.status = 'desativado';
  lab.returnedToStock = true;
  lab.history.push({
    user: req.user._id,
    action: 'desativado',
    note: req.body.note || 'Laboratório desativado, equipamentos retornados ao estoque',
  });
  await lab.save();

  const populated = await Laboratory.findById(lab._id).populate(populateRefs);
  res.json({ success: true, laboratory: populated });
});

/**
 * Registrar VISTORIA/MANUTENÇÃO do laboratório (admin ou técnico).
 * Atualiza os contadores de status dos computadores (active/maintenance/defective),
 * grava a data da última vistoria e registra no histórico.
 */
/** Detalhe de uma estação. */
exports.getStation = asyncHandler(async (req, res) => {
  const lab = await Laboratory.findById(req.params.id)
    .populate('school', 'name inep');
  if (!lab) throw new AppError('Laboratório não encontrado', 404);

  const station = lab.stations.id(req.params.stationId)
    || lab.stations.find((s) => s.code === req.params.stationId);
  if (!station) throw new AppError('Estação não encontrada', 404);

  res.json({ success: true, station, lab: { _id: lab._id, name: lab.name, school: lab.school } });
});

/**
 * Atualiza uma estação (admin ou técnico): apenas status e observação.
 * A estação é identificada só pelo número (PCnn).
 */
exports.updateStation = asyncHandler(async (req, res) => {
  if (!['admin', 'tecnico'].includes(req.user.role)) {
    throw new AppError('Apenas técnicos ou administradores podem editar estações', 403);
  }
  const lab = await Laboratory.findById(req.params.id);
  if (!lab) throw new AppError('Laboratório não encontrado', 404);

  const station = lab.stations.id(req.params.stationId)
    || lab.stations.find((s) => s.code === req.params.stationId);
  if (!station) throw new AppError('Estação não encontrada', 404);

  const { status, notes } = req.body;
  const prevStatus = station.status;

  if (status && Laboratory.STATION_STATUS.includes(status)) {
    station.status = status;
  }
  if (notes !== undefined) station.notes = notes;

  station.lastMaintenanceAt = new Date();
  if (status && status !== prevStatus) {
    lab.history.push({
      user: req.user._id,
      action: 'estacao_status',
      note: `Estação ${station.code}: ${prevStatus} → ${station.status}`,
    });
  }

  // Mantém os contadores do card coerentes com o mapa
  stationService.recomputeComputerStatus(lab);
  await lab.save();

  const populated = await Laboratory.findById(lab._id).populate(populateRefs);
  res.json({ success: true, laboratory: populated });
});

exports.inspect = asyncHandler(async (req, res) => {
  if (!['admin', 'tecnico'].includes(req.user.role)) {
    throw new AppError('Apenas técnicos ou administradores podem registrar manutenção/vistoria', 403);
  }

  const lab = await Laboratory.findById(req.params.id);
  if (!lab) throw new AppError('Laboratório não encontrado', 404);

  const active = Math.max(0, Number(req.body.active) || 0);
  const maintenance = Math.max(0, Number(req.body.maintenance) || 0);
  const defective = Math.max(0, Number(req.body.defective) || 0);
  const note = (req.body.note || '').trim();

  // Total de computadores no inventário do lab
  const totalComputers = (lab.equipments || [])
    .filter(e => String(e.type).toLowerCase().trim() === 'computador')
    .reduce((a, e) => a + (e.quantity || 0), 0);

  if (active + maintenance + defective > totalComputers) {
    throw new AppError(
      `A soma (ativos ${active} + manutenção ${maintenance} + defeito ${defective} = ${active + maintenance + defective}) ` +
      `não pode passar do total de computadores do laboratório (${totalComputers}).`,
      400
    );
  }

  lab.computerStatus = { active, maintenance, defective };
  lab.lastInspectionAt = new Date();
  lab.history.push({
    user: req.user._id,
    action: 'vistoria',
    note: note
      ? `Vistoria: ${active} ativo(s), ${maintenance} em manutenção, ${defective} com defeito — ${note}`
      : `Vistoria: ${active} ativo(s), ${maintenance} em manutenção, ${defective} com defeito`,
  });

  await lab.save();
  const populated = await Laboratory.findById(lab._id).populate(populateRefs);
  res.json({ success: true, laboratory: populated });
});

exports.summary = asyncHandler(async (_req, res) => {
  const byStatus = await Laboratory.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const total = await Laboratory.countDocuments();
  const concluidos = await Laboratory.countDocuments({ status: 'concluido' });

  const equipsAgg = await Laboratory.aggregate([
    { $match: { status: { $in: ['planejado', 'em_montagem', 'concluido', 'manutencao'] } } },
    { $unwind: '$equipments' },
    { $group: { _id: null, total: { $sum: '$equipments.quantity' } } },
  ]);

  // === Indicadores de gestão (apenas laboratórios de informática) ===
  const indicators = await computeLabIndicators();

  res.json({
    success: true,
    data: {
      total, concluidos,
      totalEquipamentosEmUso: equipsAgg[0]?.total || 0,
      byStatus,
      indicators,
    },
  });
});

/** Endpoint dedicado ao dashboard de laboratórios (KPIs + listas). */
exports.dashboard = asyncHandler(async (_req, res) => {
  const indicators = await computeLabIndicators();
  res.json({ success: true, data: indicators });
});

exports.termPdf = asyncHandler(async (req, res) => {
  const buf = await termService.buildPdf(req.params.id);
  const lab = await Laboratory.findById(req.params.id).select('deliveryTermNumber name');
  const fname = `termo-entrega-${(lab?.deliveryTermNumber || req.params.id).replace('/', '-')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.end(buf);
});

exports.termDocx = asyncHandler(async (req, res) => {
  const buf = await termService.buildDocx(req.params.id);
  const lab = await Laboratory.findById(req.params.id).select('deliveryTermNumber name');
  const fname = `termo-entrega-${(lab?.deliveryTermNumber || req.params.id).replace('/', '-')}.docx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.end(buf);
});
