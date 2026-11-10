const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { z } = require('zod');
const ExcelJS = require('exceljs');
const School = require('../models/School');
const InternetRequest = require('../models/InternetRequest');
const { authenticate, authorize } = require('../middlewares/auth');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const types = { sem_internet: 'Sem internet', lenta_instavel: 'Internet lenta ou instável', local_especifico: 'Problema em local específico', outro: 'Outro' };
const statuses = { recebida: 'Recebida', verificada: 'Verificada', encaminhada: 'Encaminhada' };
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Muitas tentativas. Aguarde e tente novamente.' } });
const submitLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Limite de envios atingido. Tente novamente mais tarde.' } });
const text = (min, max) => z.string().trim().min(min).max(max);
const submission = z.object({ inep: z.string().regex(/^\d{8}$/), contactName: text(2, 100), phone: text(8, 30).refine(v => (v.match(/\d/g) || []).length >= 10, 'Informe um telefone com DDD'), issueType: z.enum(Object.keys(types)), description: text(10, 2000), since: text(2, 100), website: z.string().max(0).optional() }).strict();
function parsed(schema, input) { const result = schema.safeParse(input); if (!result.success) throw new AppError('Confira os dados informados e tente novamente.', 400); return result.data; }
const hash = token => crypto.createHash('sha256').update(token).digest('hex');

// Rotas públicas não retornam telefone, notas internas ou identificadores internos.
router.get('/public/school/:inep', limiter, asyncHandler(async (req, res) => {
  if (!/^\d{8}$/.test(req.params.inep)) throw new AppError('Informe um INEP de 8 dígitos.', 400);
  const school = await School.findOne({ inep: req.params.inep }).select('name inep').lean();
  if (!school) throw new AppError('Escola não encontrada. Confira o INEP ou entre em contato com a TI.', 404);
  res.set('Cache-Control', 'no-store').json({ success: true, school: { name: school.name, inep: school.inep } });
}));
router.post('/public/requests', limiter, submitLimiter, asyncHandler(async (req, res) => {
  const data = parsed(submission, req.body);
  const school = await School.findOne({ inep: data.inep }).select('name inep').lean();
  if (!school) throw new AppError('Escola não encontrada.', 404);
  const token = crypto.randomBytes(32).toString('hex');
  await InternetRequest.create({ school: school._id, schoolName: school.name, inep: school.inep, contactName: data.contactName, phone: data.phone, issueType: data.issueType, description: data.description, since: data.since, trackingHash: hash(token) });
  res.set('Cache-Control', 'no-store').status(201).json({ success: true, token });
}));
// Token no corpo POST, não na URL da API; a página o guarda no fragmento da URL.
router.post('/public/tracking', limiter, asyncHandler(async (req, res) => {
  const { token } = parsed(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict(), req.body);
  const item = await InternetRequest.findOne({ trackingHash: hash(token), deletedAt: null }).select('schoolName status createdAt verifiedAt forwardedAt').lean();
  if (!item) throw new AppError('Link de acompanhamento inválido.', 404);
  res.set('Cache-Control', 'no-store').json({ success: true, request: { schoolName: item.schoolName, status: item.status, createdAt: item.createdAt, verifiedAt: item.verifiedAt, forwardedAt: item.forwardedAt } });
}));

router.use(authenticate, authorize('admin', 'tecnico', 'atendente'));
function makeFilter(query) {
  const filter = { deletedAt: null };
  if (query.status) {
    if (!statuses[query.status]) throw new AppError('Status inválido.', 400);
    filter.status = query.status;
  }
  if (query.inep) {
    const value = String(query.inep).trim();
    if (!/^\d{1,8}$/.test(value)) throw new AppError('INEP inválido.', 400);
    filter.inep = new RegExp('^' + value);
  }
  if (query.from || query.to) {
    filter.createdAt = {};
    for (const [field, suffix, operator] of [['from', 'T00:00:00.000-03:00', '$gte'], ['to', 'T23:59:59.999-03:00', '$lte']]) {
      if (query[field]) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(query[field])) throw new AppError('Data inválida.', 400);
        const date = new Date(query[field] + suffix);
        if (isNaN(date.getTime())) throw new AppError('Data inválida.', 400);
        filter.createdAt[operator] = date;
      }
    }
  }
  return filter;
}
router.get('/requests', asyncHandler(async (req, res) => {
  const filter = makeFilter(req.query);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1), limit = 15;
  const [items, total] = await Promise.all([
    InternetRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('verifiedBy forwardedBy', 'name').lean(),
    InternetRequest.countDocuments(filter),
  ]);
  res.json({ success: true, items, pagination: { page, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
}));
router.get('/summary', asyncHandler(async (req, res) => {
  const filter = makeFilter(req.query);
  const [byStatus, byType, bySchool, avg] = await Promise.all([
    InternetRequest.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    InternetRequest.aggregate([{ $match: filter }, { $group: { _id: '$issueType', count: { $sum: 1 } } }]),
    InternetRequest.aggregate([{ $match: filter }, { $group: { _id: { inep: '$inep', name: '$schoolName' }, count: { $sum: 1 } } }, { $sort: { count: -1, '_id.name': 1 } }, { $limit: 20 }]),
    InternetRequest.aggregate([{ $match: { ...filter, forwardedAt: { $exists: true, $ne: null } } }, { $group: { _id: null, hours: { $avg: { $divide: [{ $subtract: ['$forwardedAt', '$createdAt'] }, 3600000] } } } }]),
  ]);
  res.json({ success: true, byStatus, byType, bySchool, averageHours: avg[0]?.hours ?? null });
}));
router.get('/report.xlsx', asyncHandler(async (req, res) => {
  const filter = makeFilter(req.query);
  const items = await InternetRequest.find(filter).sort({ createdAt: -1 }).populate('verifiedBy forwardedBy', 'name').lean();
  const wb = new ExcelJS.Workbook(); const sheet = wb.addWorksheet('Internet das escolas');
  sheet.columns = [
    { header: 'Recebida em', key: 'createdAt', width: 22 }, { header: 'INEP', key: 'inep', width: 14 }, { header: 'Escola', key: 'schoolName', width: 35 },
    { header: 'Contato', key: 'contactName', width: 25 }, { header: 'Telefone', key: 'phone', width: 20 }, { header: 'Problema', key: 'issueType', width: 27 },
    { header: 'Descrição', key: 'description', width: 45 }, { header: 'Desde quando', key: 'since', width: 20 }, { header: 'Situação', key: 'status', width: 18 },
    { header: 'Verificada em', key: 'verifiedAt', width: 22 }, { header: 'Verificada por', key: 'verifiedBy', width: 25 },
    { header: 'Encaminhada em', key: 'forwardedAt', width: 22 }, { header: 'Encaminhada por', key: 'forwardedBy', width: 25 },
    { header: 'Protocolo do provedor', key: 'providerProtocol', width: 25 }, { header: 'Observações internas', key: 'internalNotes', width: 45 },
  ];
  sheet.getRow(1).font = { bold: true };
  const fmt = d => d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Belem' }) : '';
  items.forEach(i => sheet.addRow({ ...i, createdAt: fmt(i.createdAt), verifiedAt: fmt(i.verifiedAt), forwardedAt: fmt(i.forwardedAt), verifiedBy: i.verifiedBy?.name || '', forwardedBy: i.forwardedBy?.name || '', status: statuses[i.status], issueType: types[i.issueType] }));
  res.set('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="internet-escolas.xlsx"');
  res.send(await wb.xlsx.writeBuffer());
}));
router.patch('/requests/:id', asyncHandler(async (req, res) => {
  const data = parsed(z.object({ status: z.enum(['verificada', 'encaminhada']), providerProtocol: z.string().trim().max(150).optional(), internalNotes: z.string().trim().max(2000).optional() }).strict(), req.body);
  const expected = data.status === 'verificada' ? 'recebida' : 'verificada';
  const now = new Date();
  const update = data.status === 'verificada'
    ? { status: data.status, verifiedAt: now, verifiedBy: req.user._id, internalNotes: data.internalNotes || '' }
    : { status: data.status, forwardedAt: now, forwardedBy: req.user._id, providerProtocol: data.providerProtocol || '', internalNotes: data.internalNotes || '' };
  const item = await InternetRequest.findOneAndUpdate({ _id: req.params.id, status: expected, deletedAt: null }, { $set: update }, { new: true, runValidators: true }).populate('verifiedBy forwardedBy', 'name');
  if (!item) throw new AppError('Solicitação não encontrada ou situação alterada. Atualize a lista.', 409);
  res.json({ success: true, request: item });
}));
// Somente administradores podem excluir; o registro fica retido para auditoria.
router.delete('/requests/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const data = parsed(z.object({ reason: text(5, 300) }).strict(), req.body);
  const item = await InternetRequest.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: req.user._id, deletionReason: data.reason } },
    { new: true, runValidators: true }
  );
  if (!item) throw new AppError('Solicitação não encontrada ou já excluída.', 404);
  res.json({ success: true, message: 'Solicitação excluída do painel e dos relatórios.' });
}));
module.exports = router;
