const asyncHandler = require('../utils/asyncHandler');
const Equipment = require('../models/Equipment');
const AppError = require('../utils/AppError');
const { getPagination, paginate } = require('../utils/paginate');
const importService = require('../services/equipmentImport.service');
const qrService = require('../services/qrcode.service');
const termService = require('../services/deliveryTerm.service');
const stockService = require('../services/stockAlert.service');

exports.list = asyncHandler(async (req, res) => {
  const { q, type, status, school } = req.query;
  const filter = {};
  if (q) {
    filter.$or = [
      { patrimonio: new RegExp(q, 'i') },
      { serialNumber: new RegExp(q, 'i') },
      { brand: new RegExp(q, 'i') },
      { model: new RegExp(q, 'i') },
      { location: new RegExp(q, 'i') },
    ];
  }
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (school) filter.school = school;

  const pagination = getPagination(req.query);
  const data = await paginate(Equipment, filter, pagination, [
    { path: 'school', select: 'name inep' },
  ]);
  res.json({ success: true, ...data });
});

exports.get = asyncHandler(async (req, res) => {
  const eq = await Equipment.findById(req.params.id)
    .populate('school', 'name inep')
    .populate('maintenanceHistory.technician', 'name')
    .populate('movements.fromSchool', 'name inep')
    .populate('movements.toSchool', 'name inep')
    .populate('movements.performedBy', 'name');
  if (!eq) throw new AppError('Equipamento não encontrado', 404);
  res.json({ success: true, equipment: eq });
});

exports.create = asyncHandler(async (req, res) => {
  const exists = await Equipment.findOne({ patrimonio: req.body.patrimonio });
  if (exists) throw new AppError('Patrimônio já cadastrado', 409);
  const eq = await Equipment.create(req.body);
  // checa alerta de estoque após criar
  stockService.checkAndNotifyLowStock().catch(() => {});
  res.status(201).json({ success: true, equipment: eq });
});

exports.update = asyncHandler(async (req, res) => {
  const eq = await Equipment.findById(req.params.id);
  if (!eq) throw new AppError('Equipamento não encontrado', 404);
  Object.assign(eq, req.body);
  await eq.save();
  stockService.checkAndNotifyLowStock().catch(() => {});
  res.json({ success: true, equipment: eq });
});

exports.remove = asyncHandler(async (req, res) => {
  const eq = await Equipment.findByIdAndDelete(req.params.id);
  if (!eq) throw new AppError('Equipamento não encontrado', 404);
  res.json({ success: true, message: 'Equipamento removido' });
});

exports.importBatch = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Envie um arquivo CSV/XLSX no campo "file"', 400);
  const result = await importService.importEquipmentBuffer(req.file.buffer, req.file.originalname);
  stockService.checkAndNotifyLowStock().catch(() => {});
  res.json({ success: true, result });
});

exports.summary = asyncHandler(async (_req, res) => {
  const byStatus = await Equipment.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const byType = await Equipment.aggregate([
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const total = await Equipment.countDocuments();
  res.json({ success: true, data: { total, byStatus, byType } });
});

// === QR CODE ============================================================
exports.qrCode = asyncHandler(async (req, res) => {
  const eq = await Equipment.findById(req.params.id);
  if (!eq) throw new AppError('Equipamento não encontrado', 404);
  const baseUrl = req.query.baseUrl || '';
  const { dataUrl, payload } = await qrService.generateEquipmentQR(eq, baseUrl);
  res.json({ success: true, dataUrl, payload });
});

exports.labelsPdf = asyncHandler(async (req, res) => {
  const { ids } = req.body || {};
  let equipments;
  if (Array.isArray(ids) && ids.length > 0) {
    equipments = await Equipment.find({ _id: { $in: ids } });
  } else {
    // todas (paginação ignorada — usa filtro opcional)
    const filter = {};
    if (req.body?.status) filter.status = req.body.status;
    if (req.body?.type) filter.type = req.body.type;
    equipments = await Equipment.find(filter).limit(500);
  }
  if (!equipments.length) throw new AppError('Nenhum equipamento selecionado', 400);
  const baseUrl = req.body?.baseUrl || '';
  const buf = await qrService.buildLabelsPdf(equipments, baseUrl);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="etiquetas-${Date.now()}.pdf"`);
  res.end(buf);
});

// === MOVIMENTAÇÃO / TRANSFERÊNCIA ========================================
exports.transfer = asyncHandler(async (req, res) => {
  const eq = await Equipment.findById(req.params.id).populate('school', 'name inep');
  if (!eq) throw new AppError('Equipamento não encontrado', 404);

  const {
    type = 'transferencia',
    toSchool,
    toLocation,
    receiverName,
    receiverRole,
    receiverCpf,
    notes,
    newStatus,
  } = req.body;

  const movement = {
    type,
    date: new Date(),
    fromSchool: eq.school?._id || null,
    fromLocation: eq.school ? '' : (eq.location || ''),
    toSchool: toSchool || null,
    toLocation: toLocation || '',
    receiverName: receiverName || '',
    receiverRole: receiverRole || '',
    receiverCpf: receiverCpf || '',
    deliveryDocNumber: `TE-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
    notes: notes || '',
    performedBy: req.user._id,
  };

  // atualiza posição atual
  eq.movements.push(movement);
  eq.school = toSchool || null;
  eq.location = toLocation || (toSchool ? '' : eq.location);

  // status sugerido
  if (newStatus) eq.status = newStatus;
  else if (type === 'entrega' || (type === 'transferencia' && toSchool)) eq.status = 'em_uso';
  else if (type === 'devolucao') eq.status = 'em_estoque';
  else if (type === 'descarte') eq.status = 'descartado';

  await eq.save();
  stockService.checkAndNotifyLowStock().catch(() => {});

  const populated = await Equipment.findById(eq._id)
    .populate('school', 'name inep')
    .populate('movements.fromSchool', 'name inep')
    .populate('movements.toSchool', 'name inep');

  res.json({ success: true, equipment: populated, movement: populated.movements.at(-1) });
});

exports.deliveryTermPdf = asyncHandler(async (req, res) => {
  const { id, movId } = req.params;
  const eq = await Equipment.findById(id)
    .populate('movements.fromSchool', 'name inep')
    .populate('movements.toSchool', 'name inep');
  if (!eq) throw new AppError('Equipamento não encontrado', 404);
  const movement = eq.movements.id(movId);
  if (!movement) throw new AppError('Movimentação não encontrada', 404);
  const buf = await termService.buildDeliveryTermPdf({ equipment: eq, movement });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="termo-${movement.deliveryDocNumber || movId}.pdf"`
  );
  res.end(buf);
});

// === ALERTAS DE ESTOQUE =================================================
exports.stockReport = asyncHandler(async (_req, res) => {
  const report = await stockService.getStockReport();
  res.json({ success: true, items: report });
});

exports.stockCheck = asyncHandler(async (_req, res) => {
  const result = await stockService.checkAndNotifyLowStock();
  res.json({ success: true, ...result });
});
