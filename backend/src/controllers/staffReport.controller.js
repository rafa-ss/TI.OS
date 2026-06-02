/**
 * Relatórios de atividades por técnico — voltado para registro do ponto
 * e prestação de contas administrativa.
 *
 * - Técnico/atendente: vê só seus próprios dados
 * - Admin: pode ver de qualquer um, ou o consolidado de todos
 */
const asyncHandler = require('../utils/asyncHandler');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const ServiceOrder = require('../models/ServiceOrder');
const Laboratory = require('../models/Laboratory');
const Activity = require('../models/Activity');
const User = require('../models/User');
const AppError = require('../utils/AppError');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const HEADER_IMG = path.join(ASSETS_DIR, 'term-header.png');
const FOOTER_IMG = path.join(ASSETS_DIR, 'term-footer.png');

const COORDENADOR = 'Jhonny Edson Cavalcante Costa';
const COORDENADOR_CARGO = 'Coordenador de Tecnologia Educacional — CTEC/SEMEC';

const ACTIVITY_TYPE_LABEL = {
  montagem_lab: 'Montagem de laboratório',
  visita_tecnica: 'Visita técnica',
  manutencao: 'Manutenção',
  reuniao: 'Reunião',
  treinamento: 'Treinamento',
  outro: 'Outro',
};

// ===== Helpers =====
function rangeFromQuery(req) {
  const from = req.query.from ? new Date(req.query.from) : new Date(new Date().setDate(1));
  const to = req.query.to ? new Date(req.query.to + 'T23:59:59') : new Date();
  return { from, to };
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtMes(d) {
  return new Date(d).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/**
 * Verifica se o usuário pode acessar dados de outro
 * (admin pode tudo; técnico/atendente só pode ver os próprios).
 */
function ensureCanAccess(req, targetUserId) {
  if (req.user.role === 'admin') return;
  if (String(targetUserId) !== String(req.user._id)) {
    throw new AppError('Você só pode visualizar seus próprios relatórios', 403);
  }
}

// =================================================================
// Endpoints JSON (para preview na tela)
// =================================================================

/**
 * Consolida atividades de um técnico no período: O.S. + Laboratórios + Atividades manuais
 */
exports.getActivities = asyncHandler(async (req, res) => {
  const { from, to } = rangeFromQuery(req);
  const userId = req.query.user || req.user._id;
  ensureCanAccess(req, userId);

  const user = await User.findById(userId).select('name email role');
  if (!user) throw new AppError('Usuário não encontrado', 404);

  // === O.S. em que o técnico participou ===
  const orders = await ServiceOrder.find({
    openedAt: { $gte: from, $lte: to },
    $or: [{ technician: userId }, { helpers: userId }],
  })
    .populate('school', 'name inep')
    .sort({ openedAt: -1 })
    .lean();

  // === Laboratórios em que ele participou ===
  const labs = await Laboratory.find({
    createdAt: { $gte: from, $lte: to },
    $or: [{ responsibleTech: userId }, { responsibles: userId }],
  })
    .populate('school', 'name inep')
    .sort({ assemblyDate: -1, createdAt: -1 })
    .lean();

  // === Atividades manuais ===
  const activities = await Activity.find({
    user: userId,
    date: { $gte: from, $lte: to },
  })
    .populate('school', 'name inep')
    .sort({ date: -1 })
    .lean();

  res.json({
    success: true,
    user,
    period: { from, to },
    summary: {
      totalOrders: orders.length,
      ordersFinalized: orders.filter(o => ['finalizada', 'entregue'].includes(o.status)).length,
      totalLabs: labs.length,
      totalActivities: activities.length,
    },
    orders,
    labs,
    activities,
  });
});

/**
 * Visão geral (admin) — todos os técnicos e seus números.
 */
exports.teamOverview = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new AppError('Acesso restrito a administradores', 403);
  const { from, to } = rangeFromQuery(req);

  const staff = await User.find({
    role: { $in: ['admin', 'tecnico'] }, active: true,
  }).select('_id name role email').sort({ name: 1 });

  const lines = [];
  for (const u of staff) {
    const [orders, finalized, labs, activities] = await Promise.all([
      ServiceOrder.countDocuments({
        openedAt: { $gte: from, $lte: to },
        $or: [{ technician: u._id }, { helpers: u._id }],
      }),
      ServiceOrder.countDocuments({
        openedAt: { $gte: from, $lte: to },
        status: { $in: ['finalizada', 'entregue'] },
        $or: [{ technician: u._id }, { helpers: u._id }],
      }),
      Laboratory.countDocuments({
        createdAt: { $gte: from, $lte: to },
        $or: [{ responsibleTech: u._id }, { responsibles: u._id }],
      }),
      Activity.countDocuments({ user: u._id, date: { $gte: from, $lte: to } }),
    ]);
    lines.push({
      _id: u._id, name: u.name, role: u.role,
      orders, finalized, labs, activities,
      total: orders + labs + activities,
    });
  }

  res.json({ success: true, period: { from, to }, members: lines });
});

// =================================================================
// Atividades manuais — CRUD
// =================================================================
exports.listMyActivities = asyncHandler(async (req, res) => {
  const userId = req.query.user || req.user._id;
  ensureCanAccess(req, userId);
  const { from, to } = rangeFromQuery(req);
  const items = await Activity.find({ user: userId, date: { $gte: from, $lte: to } })
    .populate('school', 'name inep')
    .sort({ date: -1 });
  res.json({ success: true, items });
});

exports.createActivity = asyncHandler(async (req, res) => {
  const userId = req.body.user || req.user._id;
  ensureCanAccess(req, userId);
  const item = await Activity.create({ ...req.body, user: userId });
  res.status(201).json({ success: true, item });
});

exports.updateActivity = asyncHandler(async (req, res) => {
  const item = await Activity.findById(req.params.id);
  if (!item) throw new AppError('Atividade não encontrada', 404);
  ensureCanAccess(req, item.user);
  Object.assign(item, req.body);
  await item.save();
  res.json({ success: true, item });
});

exports.removeActivity = asyncHandler(async (req, res) => {
  const item = await Activity.findById(req.params.id);
  if (!item) throw new AppError('Atividade não encontrada', 404);
  ensureCanAccess(req, item.user);
  await item.deleteOne();
  res.json({ success: true });
});

// =================================================================
// PDF — Relatório individual de atividades
// =================================================================
function paintHeaderFooter(doc) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const margin = 40;
  const contentW = pageW - margin * 2;
  doc.save();
  if (fs.existsSync(HEADER_IMG)) {
    const h = contentW * (141 / 944);
    doc.image(HEADER_IMG, margin, 20, { width: contentW, height: h });
  }
  if (fs.existsSync(FOOTER_IMG)) {
    const h = contentW * (133 / 946);
    doc.image(FOOTER_IMG, margin, pageH - h - 15, { width: contentW, height: h });
  }
  doc.restore();
}

function drawSignature(doc) {
  const contentW = doc.page.width - 120;
  if (doc.y > doc.page.height - 200) doc.addPage();

  doc.moveDown(2);
  doc.font('Helvetica').fontSize(10).fillColor('#000')
    .text(`Abaetetuba/PA, ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      60, doc.y, { align: 'center', width: contentW });

  doc.moveDown(4);
  const sigY = doc.y;
  const lineW = 280;
  const lineX = (doc.page.width - lineW) / 2;
  doc.moveTo(lineX, sigY).lineTo(lineX + lineW, sigY).strokeColor('#000').lineWidth(0.6).stroke();
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000')
    .text(COORDENADOR, lineX, sigY + 6, { width: lineW, align: 'center' });
  doc.font('Helvetica').fontSize(9).fillColor('#475569')
    .text(COORDENADOR_CARGO, lineX, sigY + 22, { width: lineW, align: 'center' });
}

function sectionTitle(doc, text) {
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#1d4ed8')
    .text(text, 60, doc.y, { width: doc.page.width - 120 });
  doc.moveDown(0.3);
}

function buildIndividualPdf(data, opts = {}) {
  return new Promise((resolve, reject) => {
    try {
      const { user, period, summary, orders, labs, activities } = data;
      const title = opts.title || 'Relatório Geral de Atividades';

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 130, bottom: 110, left: 60, right: 60 },
      });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('pageAdded', () => paintHeaderFooter(doc));
      paintHeaderFooter(doc);

      const contentW = doc.page.width - 120;

      // === Cabeçalho ===
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#000')
        .text(title.toUpperCase(), 60, doc.y, { align: 'center', width: contentW });
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(10).fillColor('#475569')
        .text(`Período: ${fmtDate(period.from)} a ${fmtDate(period.to)}`,
          60, doc.y, { align: 'center', width: contentW });
      doc.moveDown(0.2);
      doc.text(`Servidor(a): ${user.name}  ·  Função: ${user.role === 'admin' ? 'Administrador' : user.role === 'tecnico' ? 'Técnico' : 'Atendente'}`,
        60, doc.y, { align: 'center', width: contentW });

      doc.moveDown(1);
      doc.moveTo(60, doc.y).lineTo(60 + contentW, doc.y).strokeColor('#1d4ed8').lineWidth(1).stroke();
      doc.moveDown(0.6);

      // === Resumo ===
      sectionTitle(doc, 'Resumo do Período');
      doc.font('Helvetica').fontSize(10).fillColor('#000');
      const boxW = (contentW - 30) / 4;
      const y0 = doc.y + 4;
      const stats = [
        { l: 'O.S. atendidas', v: summary.totalOrders },
        { l: 'O.S. finalizadas', v: summary.ordersFinalized },
        { l: 'Laboratórios', v: summary.totalLabs },
        { l: 'Ativ. externas', v: summary.totalActivities },
      ];
      stats.forEach((s, i) => {
        const x = 60 + i * (boxW + 10);
        doc.roundedRect(x, y0, boxW, 50, 6).fillAndStroke('#eff6ff', '#bfdbfe');
        doc.fillColor('#1d4ed8').font('Helvetica-Bold').fontSize(18)
          .text(String(s.v), x, y0 + 8, { width: boxW, align: 'center' });
        doc.fillColor('#475569').font('Helvetica').fontSize(9)
          .text(s.l, x, y0 + 30, { width: boxW, align: 'center' });
      });
      doc.y = y0 + 65;

      // === Atividades externas (respaldo do ponto) ===
      if (activities.length > 0) {
        sectionTitle(doc, 'Atividades Externas (Respaldo do Ponto)');
        activities.forEach((a, i) => {
          if (doc.y > doc.page.height - 200) doc.addPage();
          const dt = fmtDate(a.date);
          const horario = (a.startTime || a.endTime) ? ` · ${a.startTime || '?'} – ${a.endTime || '?'}` : '';
          const local = a.school?.name || a.location || '—';
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#000')
            .text(`${i + 1}. ${dt}${horario} — ${ACTIVITY_TYPE_LABEL[a.type] || a.type}`,
              60, doc.y, { width: contentW });
          doc.font('Helvetica').fontSize(10).fillColor('#334155')
            .text(`Local: ${local}`, 70, doc.y, { width: contentW - 10 });
          doc.fillColor('#000').text(a.description, 70, doc.y, { width: contentW - 10, align: 'justify' });
          doc.moveDown(0.5);
        });
        doc.moveDown(0.5);
      }

      // === Laboratórios ===
      if (labs.length > 0) {
        if (doc.y > doc.page.height - 200) doc.addPage();
        sectionTitle(doc, 'Laboratórios Montados / Acompanhados');
        labs.forEach((l, i) => {
          if (doc.y > doc.page.height - 180) doc.addPage();
          const equipTotal = (l.equipments || []).reduce((sum, e) => sum + (e.quantity || 0), 0);
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#000')
            .text(`${i + 1}. ${l.name} — ${l.school?.name || 'sem escola'}`,
              60, doc.y, { width: contentW });
          doc.font('Helvetica').fontSize(9).fillColor('#475569')
            .text(`${fmtDate(l.assemblyDate || l.createdAt)} · Status: ${l.status} · ${equipTotal} equipamento(s)`,
              70, doc.y, { width: contentW - 10 });
          doc.moveDown(0.5);
        });
        doc.moveDown(0.5);
      }

      // === O.S. ===
      if (orders.length > 0) {
        if (doc.y > doc.page.height - 200) doc.addPage();
        sectionTitle(doc, 'Ordens de Serviço Atendidas');

        // Cabeçalho da tabela
        const colW = [60, contentW - 60 - 80 - 100, 80, 100];
        const startX = 60;
        let y = doc.y;
        doc.rect(startX, y, contentW, 20).fillAndStroke('#e2e8f0', '#94a3b8');
        doc.fillColor('#000').font('Helvetica-Bold').fontSize(9);
        ['Nº', 'Escola / Problema', 'Status', 'Data'].forEach((h, i) => {
          const x = startX + colW.slice(0, i).reduce((a, c) => a + c, 0);
          doc.text(h, x + 4, y + 6, { width: colW[i] - 8 });
        });
        y += 20;
        doc.font('Helvetica').fontSize(9);
        for (const o of orders) {
          if (y > doc.page.height - 150) { doc.addPage(); y = doc.y; }
          const rowH = 28;
          doc.fillColor('#000').rect(startX, y, contentW, rowH).stroke('#cbd5e1');
          const cells = [
            o.number || '-',
            `${o.school?.name || 'Sem escola'}\n${(o.problemReported || '').substring(0, 60)}`,
            o.status,
            fmtDate(o.openedAt),
          ];
          cells.forEach((txt, i) => {
            const x = startX + colW.slice(0, i).reduce((a, c) => a + c, 0);
            doc.text(String(txt), x + 4, y + 4, { width: colW[i] - 8, height: rowH - 4 });
          });
          y += rowH;
        }
        doc.y = y + 10;
      }

      // Quando vazio
      if (orders.length === 0 && labs.length === 0 && activities.length === 0) {
        doc.moveDown(2);
        doc.font('Helvetica').fontSize(11).fillColor('#94a3b8')
          .text('Nenhuma atividade registrada neste período.',
            60, doc.y, { align: 'center', width: contentW });
      }

      // === Assinatura única do Coordenador ===
      drawSignature(doc);

      doc.end();
    } catch (e) { reject(e); }
  });
}

// =================================================================
// Endpoints de PDF
// =================================================================
exports.individualPdf = asyncHandler(async (req, res) => {
  const userId = req.query.user || req.user._id;
  ensureCanAccess(req, userId);
  const { from, to } = rangeFromQuery(req);
  const user = await User.findById(userId).select('name email role');
  if (!user) throw new AppError('Usuário não encontrado', 404);

  const [orders, labs, activities] = await Promise.all([
    ServiceOrder.find({
      openedAt: { $gte: from, $lte: to },
      $or: [{ technician: userId }, { helpers: userId }],
    }).populate('school', 'name inep').sort({ openedAt: -1 }).lean(),
    Laboratory.find({
      createdAt: { $gte: from, $lte: to },
      $or: [{ responsibleTech: userId }, { responsibles: userId }],
    }).populate('school', 'name inep').sort({ assemblyDate: -1 }).lean(),
    Activity.find({ user: userId, date: { $gte: from, $lte: to } })
      .populate('school', 'name inep').sort({ date: -1 }).lean(),
  ]);

  const summary = {
    totalOrders: orders.length,
    ordersFinalized: orders.filter(o => ['finalizada', 'entregue'].includes(o.status)).length,
    totalLabs: labs.length,
    totalActivities: activities.length,
  };

  const isTipoRespaldo = req.query.tipo === 'respaldo';
  const titulo = isTipoRespaldo
    ? 'Respaldo de Ponto — Atividades Externas'
    : 'Relatório Geral de Atividades';

  const buf = await buildIndividualPdf(
    { user, period: { from, to }, summary, orders, labs, activities },
    { title: titulo }
  );

  const fname = `${isTipoRespaldo ? 'respaldo-ponto' : 'relatorio-atividades'}-${user.name.replace(/\s+/g, '_')}-${fmtMes(from).replace(/\s/g, '_')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.end(buf);
});

exports.teamPdf = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new AppError('Apenas admin', 403);
  const { from, to } = rangeFromQuery(req);

  const staff = await User.find({
    role: { $in: ['admin', 'tecnico'] }, active: true,
  }).select('_id name role').sort({ name: 1 });

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 130, bottom: 110, left: 60, right: 60 },
  });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-geral-equipe-${fmtMes(from).replace(/\s/g, '_')}.pdf"`);
    res.end(Buffer.concat(chunks));
  });
  doc.on('pageAdded', () => paintHeaderFooter(doc));
  paintHeaderFooter(doc);

  const contentW = doc.page.width - 120;
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#000')
    .text('RELATÓRIO GERAL DE ATIVIDADES — EQUIPE CTEC',
      60, doc.y, { align: 'center', width: contentW });
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(10).fillColor('#475569')
    .text(`Período: ${fmtDate(from)} a ${fmtDate(to)}`,
      60, doc.y, { align: 'center', width: contentW });

  doc.moveDown(1);
  doc.moveTo(60, doc.y).lineTo(60 + contentW, doc.y).strokeColor('#1d4ed8').lineWidth(1).stroke();
  doc.moveDown(0.6);

  sectionTitle(doc, 'Atividades por Servidor');

  // Tabela
  const cols = [
    { l: 'Servidor', w: contentW - 70 - 60 - 60 - 60 },
    { l: 'O.S.', w: 60, align: 'center' },
    { l: 'Finaliz.', w: 60, align: 'center' },
    { l: 'Labs', w: 60, align: 'center' },
    { l: 'Externas', w: 70, align: 'center' },
  ];
  let y = doc.y;
  doc.rect(60, y, contentW, 22).fillAndStroke('#e2e8f0', '#94a3b8');
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(10);
  let x = 60;
  cols.forEach(c => {
    doc.text(c.l, x + 4, y + 6, { width: c.w - 8, align: c.align || 'left' });
    x += c.w;
  });
  y += 22;

  doc.font('Helvetica').fontSize(10);
  for (const u of staff) {
    if (y > doc.page.height - 180) { doc.addPage(); y = doc.y; }
    const [orders, finalized, labs, activities] = await Promise.all([
      ServiceOrder.countDocuments({
        openedAt: { $gte: from, $lte: to },
        $or: [{ technician: u._id }, { helpers: u._id }],
      }),
      ServiceOrder.countDocuments({
        openedAt: { $gte: from, $lte: to },
        status: { $in: ['finalizada', 'entregue'] },
        $or: [{ technician: u._id }, { helpers: u._id }],
      }),
      Laboratory.countDocuments({
        createdAt: { $gte: from, $lte: to },
        $or: [{ responsibleTech: u._id }, { responsibles: u._id }],
      }),
      Activity.countDocuments({ user: u._id, date: { $gte: from, $lte: to } }),
    ]);

    doc.rect(60, y, contentW, 22).stroke('#cbd5e1');
    x = 60;
    [u.name + ` (${u.role === 'admin' ? 'Admin' : 'Téc.'})`, orders, finalized, labs, activities]
      .forEach((v, i) => {
        doc.fillColor('#000').text(String(v), x + 4, y + 6,
          { width: cols[i].w - 8, align: cols[i].align || 'left' });
        x += cols[i].w;
      });
    y += 22;
  }
  doc.y = y + 10;

  drawSignature(doc);
  doc.end();
});
