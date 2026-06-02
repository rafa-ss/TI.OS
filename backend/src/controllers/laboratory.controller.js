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
  const { name, school, equipments = [], responsibleTech, responsibles, status, assemblyDate, notes } = req.body;
  if (!name) throw new AppError('Informe o nome do laboratório', 400);
  if (!school) throw new AppError('Selecione a escola', 400);

  // Verifica estoque ANTES de criar
  if (equipments.length > 0) {
    const check = await labService.checkAvailability(equipments);
    if (!check.ok) {
      throw new AppError(
        'Estoque insuficiente para montar este laboratório',
        400,
        check.missing
      );
    }
  }

  // Debita do estoque
  if (equipments.length > 0) {
    await labService.debitStock(equipments);
  }

  const lab = await Laboratory.create({
    name,
    school,
    responsibleTech: responsibleTech || undefined,
    responsibles: Array.isArray(responsibles) ? responsibles.filter(Boolean) : [],
    status: status || 'planejado',
    assemblyDate: assemblyDate || undefined,
    notes: notes || '',
    equipments,
    createdBy: req.user._id,
    history: [{
      user: req.user._id,
      action: 'criado',
      note: `Laboratório criado com ${equipments.reduce((a, e) => a + e.quantity, 0)} equipamento(s)`,
    }],
  });

  const populated = await Laboratory.findById(lab._id).populate(populateRefs);
  res.status(201).json({ success: true, laboratory: populated });
});

exports.update = asyncHandler(async (req, res) => {
  const lab = await Laboratory.findById(req.params.id);
  if (!lab) throw new AppError('Laboratório não encontrado', 404);

  // Não permite editar a lista de equipamentos por aqui (evita descompasso com estoque)
  const { equipments, ...rest } = req.body;

  const oldStatus = lab.status;
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

  // Devolve ao estoque ANTES de excluir (se ainda não devolveu)
  if (!lab.returnedToStock && lab.equipments.length > 0) {
    await labService.returnToStock(
      lab.equipments,
      'Almoxarifado semec',
      `Devolução por exclusão do laboratório: ${lab.name}`
    );
  }

  await lab.deleteOne();
  res.json({ success: true, message: 'Laboratório removido e equipamentos devolvidos ao estoque' });
});

/**
 * Desativa o laboratório e devolve equipamentos ao estoque.
 */
exports.deactivate = asyncHandler(async (req, res) => {
  const lab = await Laboratory.findById(req.params.id);
  if (!lab) throw new AppError('Laboratório não encontrado', 404);
  if (lab.returnedToStock) {
    throw new AppError('Equipamentos já foram devolvidos ao estoque', 400);
  }

  if (lab.equipments.length > 0) {
    await labService.returnToStock(
      lab.equipments,
      'Almoxarifado semec',
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
 * Resumo geral dos laboratórios.
 */
exports.summary = asyncHandler(async (_req, res) => {
  const byStatus = await Laboratory.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const total = await Laboratory.countDocuments();
  const concluidos = await Laboratory.countDocuments({ status: 'concluido' });

  // Soma todos os equipamentos em uso em laboratórios ativos
  const equipsAgg = await Laboratory.aggregate([
    { $match: { status: { $in: ['planejado', 'em_montagem', 'concluido', 'manutencao'] } } },
    { $unwind: '$equipments' },
    { $group: { _id: null, total: { $sum: '$equipments.quantity' } } },
  ]);

  res.json({
    success: true,
    data: {
      total,
      concluidos,
      totalEquipamentosEmUso: equipsAgg[0]?.total || 0,
      byStatus,
    },
  });
});

// === Termo de Entrega (PDF / DOCX) ===
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
