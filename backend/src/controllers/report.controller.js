const asyncHandler = require('../utils/asyncHandler');
const reportService = require('../services/report.service');

exports.ordersExcel = asyncHandler(async (req, res) => {
  const buf = await reportService.buildOrdersExcel(req.query);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="ordens-${Date.now()}.xlsx"`);
  res.end(buf);
});

exports.ordersPdf = asyncHandler(async (req, res) => {
  const buf = await reportService.buildOrdersPdf(req.query);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="ordens-${Date.now()}.pdf"`);
  res.end(buf);
});

exports.byTechnician = asyncHandler(async (req, res) => {
  const data = await reportService.ordersByTechnician(req.query);
  res.json({ success: true, data });
});

exports.bySchool = asyncHandler(async (req, res) => {
  const data = await reportService.ordersBySchool(req.query);
  res.json({ success: true, data });
});

exports.mostMaintained = asyncHandler(async (_req, res) => {
  const data = await reportService.mostMaintainedEquipment();
  res.json({ success: true, data });
});

exports.laboratoriesExcel = asyncHandler(async (req, res) => {
  const buf = await reportService.buildLaboratoriesExcel(req.query);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="laboratorios-${Date.now()}.xlsx"`);
  res.end(buf);
});
