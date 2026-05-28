const asyncHandler = require('../utils/asyncHandler');
const School = require('../models/School');
const ServiceOrder = require('../models/ServiceOrder');
const AppError = require('../utils/AppError');
const { getPagination, paginate } = require('../utils/paginate');
const importService = require('../services/import.service');

exports.list = asyncHandler(async (req, res) => {
  const { q, situacao, municipio } = req.query;
  const filter = {};
  if (q) {
    filter.$or = [
      { name: new RegExp(q, 'i') },
      { inep: new RegExp(q, 'i') },
      { municipio: new RegExp(q, 'i') },
    ];
  }
  if (situacao) filter.situacao = situacao;
  if (municipio) filter.municipio = municipio;

  const pagination = getPagination(req.query);
  const data = await paginate(School, filter, pagination);
  res.json({ success: true, ...data });
});

exports.options = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const filter = q
    ? {
        $or: [{ name: new RegExp(q, 'i') }, { inep: new RegExp(q, 'i') }],
      }
    : {};
  const schools = await School.find(filter)
    .select('_id name inep municipio')
    .sort({ name: 1 })
    .limit(50);
  res.json({ success: true, items: schools });
});

exports.get = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id);
  if (!school) throw new AppError('Escola não encontrada', 404);
  res.json({ success: true, school });
});

exports.create = asyncHandler(async (req, res) => {
  const { inep, name } = req.body;
  if (!inep || !name) throw new AppError('INEP e nome são obrigatórios', 400);

  const exists = await School.findOne({ inep: String(inep).trim() });
  if (exists) throw new AppError(`Já existe escola com este INEP: ${exists.name}`, 409);

  const school = await School.create({
    inep: String(inep).trim(),
    name: String(name).trim(),
    municipio: req.body.municipio || 'Abaetetuba',
    uf: req.body.uf || 'PA',
    situacao: req.body.situacao || 'Ativa',
    dependenciaAdm: req.body.dependenciaAdm || '',
    localizacao: req.body.localizacao || '',
    endereco: req.body.endereco || '',
    importedFrom: 'manual',
  });
  res.status(201).json({ success: true, school });
});

exports.update = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id);
  if (!school) throw new AppError('Escola não encontrada', 404);

  // Se quiser mudar o INEP, garantir que não duplique
  if (req.body.inep && req.body.inep !== school.inep) {
    const other = await School.findOne({ inep: req.body.inep });
    if (other) throw new AppError('Já existe outra escola com este INEP', 409);
  }
  Object.assign(school, req.body);
  await school.save();
  res.json({ success: true, school });
});

exports.remove = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id);
  if (!school) throw new AppError('Escola não encontrada', 404);

  // Bloqueia exclusão se houver O.S. vinculada
  const linkedCount = await ServiceOrder.countDocuments({ school: school._id });
  if (linkedCount > 0) {
    throw new AppError(
      `Não é possível excluir: existem ${linkedCount} ordem(ns) de serviço vinculada(s) a esta escola.`,
      409
    );
  }

  await school.deleteOne();
  res.json({ success: true, message: 'Escola removida' });
});

exports.importCenso = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Envie um arquivo CSV/XLSX no campo "file"', 400);
  const result = await importService.importCensoBuffer(req.file.buffer, req.file.originalname);
  res.json({ success: true, result });
});
