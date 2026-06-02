const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const ServiceOrder = require('../models/ServiceOrder');
const Equipment = require('../models/Equipment');

const STATUS_LABEL = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  aguardando_peca: 'Aguardando peça',
  finalizada: 'Finalizada',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
};

const PRIORITY_LABEL = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

async function listOrdersByFilter(filters = {}) {
  const q = {};
  if (filters.from || filters.to) {
    q.openedAt = {};
    if (filters.from) q.openedAt.$gte = new Date(filters.from);
    if (filters.to) q.openedAt.$lte = new Date(filters.to);
  }
  if (filters.technician) q.technician = filters.technician;
  if (filters.school) q.school = filters.school;
  if (filters.status) q.status = filters.status;
  return ServiceOrder.find(q)
    .populate('technician', 'name email')
    .populate('school', 'name inep')
    .sort({ openedAt: -1 })
    .lean();
}

async function buildOrdersExcel(filters) {
  const orders = await listOrdersByFilter(filters);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Ordens de Serviço');

  ws.columns = [
    { header: 'Nº O.S.', key: 'number', width: 18 },
    { header: 'Abertura', key: 'openedAt', width: 18 },
    { header: 'Conclusão', key: 'closedAt', width: 18 },
    { header: 'Escola', key: 'school', width: 35 },
    { header: 'INEP', key: 'inep', width: 14 },
    { header: 'Solicitante', key: 'requesterName', width: 25 },
    { header: 'Equipamento', key: 'equipmentType', width: 18 },
    { header: 'Patrimônio', key: 'patrimonio', width: 16 },
    { header: 'Problema', key: 'problemReported', width: 50 },
    { header: 'Serviço', key: 'serviceDone', width: 50 },
    { header: 'Técnico', key: 'technician', width: 25 },
    { header: 'Prioridade', key: 'priority', width: 12 },
    { header: 'Status', key: 'status', width: 18 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7490' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  for (const o of orders) {
    ws.addRow({
      number: o.number,
      openedAt: o.openedAt ? new Date(o.openedAt).toLocaleString('pt-BR') : '',
      closedAt: o.closedAt ? new Date(o.closedAt).toLocaleString('pt-BR') : '',
      school: o.school?.name || '',
      inep: o.inep || o.school?.inep || '',
      requesterName: o.requesterName,
      equipmentType: o.equipmentType,
      patrimonio: o.patrimonio,
      problemReported: o.problemReported,
      serviceDone: o.serviceDone,
      technician: o.technician?.name || '',
      priority: PRIORITY_LABEL[o.priority] || o.priority,
      status: STATUS_LABEL[o.status] || o.status,
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function buildOrdersPdf(filters) {
  return new Promise(async (resolve, reject) => {
    try {
      const orders = await listOrdersByFilter(filters);
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(16).text('Relatório de Ordens de Serviço', { align: 'center' });
      doc.moveDown(0.3);
      doc
        .fontSize(9)
        .fillColor('#555')
        .text(`semec Abaetetuba - T.I. | Gerado em ${new Date().toLocaleString('pt-BR')}`, {
          align: 'center',
        });
      doc.moveDown();

      doc.fillColor('#000').fontSize(10);
      orders.forEach((o, idx) => {
        if (doc.y > 500) doc.addPage();
        doc.font('Helvetica-Bold').text(`${idx + 1}. ${o.number}  -  ${STATUS_LABEL[o.status] || o.status}`);
        doc
          .font('Helvetica')
          .fontSize(9)
          .text(
            `Escola: ${o.school?.name || '-'} (INEP ${o.inep || '-'})  |  Solicitante: ${o.requesterName}  |  Técnico: ${o.technician?.name || '-'}`
          );
        doc.text(
          `Equipamento: ${o.equipmentType || '-'} (Pat. ${o.patrimonio || '-'})  |  Prioridade: ${PRIORITY_LABEL[o.priority]}`
        );
        doc.text(`Problema: ${o.problemReported || '-'}`);
        if (o.serviceDone) doc.text(`Serviço: ${o.serviceDone}`);
        doc.moveDown(0.6);
      });

      if (!orders.length) {
        doc.moveDown(2).text('Nenhuma O.S. encontrada para os filtros informados.', { align: 'center' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function ordersByTechnician(filters) {
  const match = {};
  if (filters.from || filters.to) {
    match.openedAt = {};
    if (filters.from) match.openedAt.$gte = new Date(filters.from);
    if (filters.to) match.openedAt.$lte = new Date(filters.to);
  }
  return ServiceOrder.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$technician',
        total: { $sum: 1 },
        finalizadas: { $sum: { $cond: [{ $in: ['$status', ['finalizada', 'entregue']] }, 1, 0] } },
        abertas: { $sum: { $cond: [{ $eq: ['$status', 'aberta'] }, 1, 0] } },
      },
    },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'tech' } },
    { $unwind: { path: '$tech', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, technician: '$tech.name', total: 1, finalizadas: 1, abertas: 1 } },
    { $sort: { total: -1 } },
  ]);
}

async function ordersBySchool(filters) {
  const match = {};
  if (filters.from || filters.to) {
    match.openedAt = {};
    if (filters.from) match.openedAt.$gte = new Date(filters.from);
    if (filters.to) match.openedAt.$lte = new Date(filters.to);
  }
  return ServiceOrder.aggregate([
    { $match: match },
    { $group: { _id: '$school', total: { $sum: 1 } } },
    { $lookup: { from: 'schools', localField: '_id', foreignField: '_id', as: 'school' } },
    { $unwind: { path: '$school', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        school: '$school.name',
        inep: '$school.inep',
        total: 1,
      },
    },
    { $sort: { total: -1 } },
    { $limit: 50 },
  ]);
}

async function mostMaintainedEquipment() {
  return ServiceOrder.aggregate([
    { $match: { equipment: { $ne: null } } },
    { $group: { _id: '$equipment', total: { $sum: 1 } } },
    { $sort: { total: -1 } },
    { $limit: 20 },
    { $lookup: { from: 'equipment', localField: '_id', foreignField: '_id', as: 'eq' } },
    { $unwind: { path: '$eq', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        patrimonio: '$eq.patrimonio',
        type: '$eq.type',
        brand: '$eq.brand',
        model: '$eq.model',
        total: 1,
      },
    },
  ]);
}

module.exports = {
  buildOrdersExcel,
  buildOrdersPdf,
  ordersByTechnician,
  ordersBySchool,
  mostMaintainedEquipment,
};
