const asyncHandler = require('../utils/asyncHandler');
const Kit = require('../models/Kit');
const AppError = require('../utils/AppError');

/** Normaliza e valida os componentes vindos do body. */
function normalizeComponents(components) {
  if (!Array.isArray(components)) return [];
  return components
    .map((c) => ({
      type: String(c.type || '').toLowerCase().trim(),
      condition: c.condition || 'novo',
      quantityPerKit: Math.max(1, Number(c.quantityPerKit) || 1),
    }))
    .filter((c) => c.type);
}

/**
 * Lista os kits. Por padrão retorna apenas os ativos; com ?all=1 retorna todos
 * (usado na tela de administração).
 */
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (!req.query.all) filter.active = true;
  if (req.query.q) filter.name = new RegExp(req.query.q, 'i');
  const kits = await Kit.find(filter).sort({ name: 1 });
  res.json({ success: true, items: kits });
});

exports.get = asyncHandler(async (req, res) => {
  const kit = await Kit.findById(req.params.id);
  if (!kit) throw new AppError('Kit não encontrado', 404);
  res.json({ success: true, kit });
});

exports.create = asyncHandler(async (req, res) => {
  const { name, description, icon, active } = req.body;
  if (!name || !name.trim()) throw new AppError('Informe o nome do kit', 400);

  const components = normalizeComponents(req.body.components);
  if (components.length === 0) {
    throw new AppError('O kit precisa ter pelo menos 1 componente', 400);
  }

  const slug = Kit.makeSlug(name);
  if (!slug) throw new AppError('Nome do kit inválido', 400);

  const dup = await Kit.findOne({ slug });
  if (dup) throw new AppError(`Já existe um kit com nome semelhante ("${dup.name}")`, 409);

  const kit = await Kit.create({
    name: name.trim(),
    slug,
    description: description || '',
    icon: icon || 'Package',
    active: active !== false,
    components,
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, kit });
});

exports.update = asyncHandler(async (req, res) => {
  const kit = await Kit.findById(req.params.id);
  if (!kit) throw new AppError('Kit não encontrado', 404);

  const { name, description, icon, active } = req.body;

  if (name !== undefined) {
    if (!name.trim()) throw new AppError('Informe o nome do kit', 400);
    const slug = Kit.makeSlug(name);
    if (slug !== kit.slug) {
      const dup = await Kit.findOne({ slug, _id: { $ne: kit._id } });
      if (dup) throw new AppError(`Já existe um kit com nome semelhante ("${dup.name}")`, 409);
      kit.slug = slug;
    }
    kit.name = name.trim();
  }

  if (description !== undefined) kit.description = description;
  if (icon !== undefined) kit.icon = icon || 'Package';
  if (active !== undefined) kit.active = !!active;

  if (req.body.components !== undefined) {
    const components = normalizeComponents(req.body.components);
    if (components.length === 0) {
      throw new AppError('O kit precisa ter pelo menos 1 componente', 400);
    }
    kit.components = components;
  }

  await kit.save();
  res.json({ success: true, kit });
});

exports.remove = asyncHandler(async (req, res) => {
  const kit = await Kit.findById(req.params.id);
  if (!kit) throw new AppError('Kit não encontrado', 404);
  // Soft-delete por padrão (mantém histórico); ?hard=1 remove de fato.
  if (req.query.hard) {
    await kit.deleteOne();
    return res.json({ success: true, message: 'Kit removido definitivamente' });
  }
  kit.active = false;
  await kit.save();
  res.json({ success: true, message: 'Kit desativado', kit });
});

module.exports = exports;
