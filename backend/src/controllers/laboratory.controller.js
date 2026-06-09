const asyncHandler = require('../utils/asyncHandler');
const Laboratory = require('../models/Laboratory');
const AppError = require('../utils/AppError');
const { getPagination, paginate } = require('../utils/paginate');
const labService = require('../services/laboratory.service');
const termService = require('../services/labDeliveryTerm.service');

const populateRefs = [
  { path: 'school', select: 'name inep municipio' },
  { path: 'responsibleTech', select: 'name email role' },
  { path: 'responsibles', select: 'name email role' },
  { path: 'createdBy', select: 'name' },
  { path: 'history.user', select: 'name' },
];

exports.list = asyncHandler(async (req, res) => {
  const { q, status, school } = req.query;
  const filter = {};
  if (q) filter.name = new RegExp(q, 'i');
  if (status) filter.status = status;
  if (school) filter.school = school;

  const pagination = getPagination(req.query);
  const data = await paginate(Laboratory, filter, pagination, populateRefs);
  res.json({ success: true, ...data });
});

exports.get = asyncHandler(async (req, res) => {
  const lab = await Laboratory.findById(req.params.id).populate(populateRefs);
  if (!lab) throw new AppError('Laboratório não encontrado', 404);
  res.json({ success: true, laboratory: lab });
});

exports.create = asyncHandler(async (req, res) => {
  const { name, school, equipments = [], responsibleTech, responsibles, status, assemblyDate, notes, kind } = req.body;
  if (!name) throw new AppError('Informe o nome do espaço', 400);
  if (!school) throw new AppError('Selecione a escola', 400);
  const kindNorm = (kind === 'administrativo') ? 'administrativo' : 'laboratorio';

  const normEqs = (equipments || []).map(e => ({
    type: String(e.type || '').toLowerCase().trim(),
    condition: e.condition || 'novo',
    quantity: Number(e.quantity) || 0,
  })).filter(e => e.type && e.quantity > 0);

  if (normEqs.length > 0) {
    const check = await labService.checkAvailability(normEqs);
    if (!check.ok) {
      throw new AppError('Estoque insuficiente para montar este laboratório', 400, check.missing);
    }
    await labService.debitStock(normEqs);
  }

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
    createdBy: req.user._id,
    history: [{
      user: req.user._id,
      action: 'criado',
      note: `${kindNorm === 'administrativo' ? 'Setor Administrativo' : 'Laboratório'} criado com ${normEqs.reduce((a, e) => a + e.quantity, 0)} equipamento(s)`,
    }],
  });

  const populated = await Laboratory.findById(lab._id).populate(populateRefs);
  res.status(201).json({ success: true, laboratory: populated });
});

exports.update = asyncHandler(async (req, res) => {
  const lab = await Laboratory.findById(req.params.id);
  if (!lab) throw new AppError('Laboratório não encontrado', 404);

  const { equipments, ...rest } = req.body;

  // Normaliza kind se vier
  if (Object.prototype.hasOwnProperty.call(rest, 'kind')) {
    rest.kind = (rest.kind === 'administrativo') ? 'administrativo' : 'laboratorio';
  }

  const oldStatus = lab.status;

  // Edição de equipamentos (apenas ADMIN pode incluir/excluir/alterar)
  if (Array.isArray(equipments)) {
    if (req.user.role !== 'admin') {
      throw new AppError(
        'Apenas administradores podem alterar a lista de equipamentos do laboratório',
        403
      );
    }
    if (lab.returnedToStock) {
      throw new AppError('Laboratório já desativado — não é possível alterar equipamentos', 400);
    }

    const normEqs = equipments.map(e => ({
      type: String(e.type || '').toLowerCase().trim(),
      condition: e.condition || 'novo',
      quantity: Number(e.quantity) || 0,
    })).filter(e => e.type && e.quantity > 0);

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
        'Almoxarifado SEMED',
        `Edição do laboratório "${lab.name}" — equipamentos devolvidos pelo admin`
      );
    }
    if (toDebit.length > 0) {
      await labService.debitStock(toDebit);
    }

    lab.equipments = normEqs;

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

  // === Edição manual do número do Termo de Entrega (apenas ADMIN) ===
  if (Object.prototype.hasOwnProperty.call(rest, 'deliveryTermNumber')) {
    if (req.user.role !== 'admin') {
      throw new AppError(
        'Apenas administradores podem alterar o número do Termo de Entrega',
        403
      );
    }
    const raw = rest.deliveryTermNumber;
    if (raw === '' || raw === null) {
      // Limpa o número (o sistema gerará um novo na próxima emissão do PDF/DOCX)
      const old = lab.deliveryTermNumber || '(vazio)';
      lab.deliveryTermNumber = '';
      lab.history.push({
        user: req.user._id,
        action: 'termo_alterado',
        note: `Nº do termo de entrega limpo (era ${old}). Será gerado novo número na próxima emissão.`,
      });
    } else {
      const val = String(raw).trim();
      // Aceita: "01/2026", "1/2026", "14/2025" (1-3 dígitos / ano 4 dígitos)
      const m = val.match(/^\s*(\d{1,3})\s*\/\s*(\d{4})\s*$/);
      if (!m) {
        throw new AppError(
          'Número do termo inválido. Use o formato NN/AAAA (ex.: 01/2026).',
          400
        );
      }
      const seq = parseInt(m[1], 10);
      const year = parseInt(m[2], 10);
      if (seq < 1) throw new AppError('O número sequencial deve ser maior que zero', 400);
      const normalized = `${String(seq).padStart(2, '0')}/${year}`;

      // Verifica duplicidade (outro lab com o mesmo número)
      const dup = await Laboratory.findOne({
        _id: { $ne: lab._id },
        deliveryTermNumber: normalized,
      }).select('_id name');
      if (dup) {
        throw new AppError(
          `O número ${normalized} já está em uso pelo laboratório "${dup.name}". Escolha outro número.`,
          409
        );
      }

      const oldNum = lab.deliveryTermNumber || '(vazio)';
      if (oldNum !== normalized) {
        lab.deliveryTermNumber = normalized;
        lab.history.push({
          user: req.user._id,
          action: 'termo_alterado',
          note: `Nº do termo de entrega alterado: ${oldNum} → ${normalized}`,
        });
      }
    }
    // remove de `rest` pra Object.assign não sobrescrever
    delete rest.deliveryTermNumber;
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
      'Almoxarifado SEMED',
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
      'Almoxarifado SEMED',
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

  res.json({
    success: true,
    data: {
      total, concluidos,
      totalEquipamentosEmUso: equipsAgg[0]?.total || 0,
      byStatus,
    },
  });
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
