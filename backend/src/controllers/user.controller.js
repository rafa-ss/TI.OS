const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { getPagination, paginate } = require('../utils/paginate');
const storageService = require('../services/storage.service');

exports.list = asyncHandler(async (req, res) => {
  const { q, role, active } = req.query;
  const filter = {};
  if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }];
  if (role) filter.role = role;
  if (active !== undefined) filter.active = active === 'true';

  const pagination = getPagination(req.query);
  const data = await paginate(User, filter, pagination);
  res.json({ success: true, ...data });
});

/**
 * Lista enxuta da equipe (técnicos + admins ativos) para seleção em formulários
 * — ex.: responsáveis pela montagem de laboratório, técnicos auxiliares de OS.
 * Acessível a admin e técnico (NÃO expõe a gestão completa de usuários).
 * Retorna apenas campos públicos: _id, name, role, email.
 */
exports.staff = asyncHandler(async (req, res) => {
  const { role } = req.query;
  const filter = { active: true, role: { $in: ['admin', 'tecnico', 'atendente'] } };
  if (role && ['admin', 'tecnico', 'atendente'].includes(role)) filter.role = role;

  const items = await User.find(filter)
    .select('name role email')
    .sort({ name: 1 })
    .lean();

  res.json({ success: true, items });
});

exports.get = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('Usuário não encontrado', 404);
  res.json({ success: true, user });
});

exports.create = asyncHandler(async (req, res) => {
  const exists = await User.findOne({ email: req.body.email.toLowerCase() });
  if (exists) throw new AppError('E-mail já cadastrado', 409);
  const user = await User.create(req.body);
  res.status(201).json({ success: true, user });
});

exports.update = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('Usuário não encontrado', 404);
  Object.assign(user, req.body);
  await user.save();
  res.json({ success: true, user });
});

exports.remove = asyncHandler(async (req, res) => {
  if (req.user._id.toString() === req.params.id) {
    throw new AppError('Você não pode remover a si mesmo', 400);
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new AppError('Usuário não encontrado', 404);
  res.json({ success: true, message: 'Usuário removido' });
});

// =============================================================
// "Meu perfil" — endpoints do próprio usuário logado
// =============================================================

/**
 * Atualiza dados básicos do próprio perfil (nome, telefone).
 * Não permite mudar role nem ativar/desativar conta.
 */
exports.updateMyProfile = asyncHandler(async (req, res) => {
  const allowed = ['name', 'phone'];
  const update = {};
  for (const f of allowed) {
    if (req.body[f] !== undefined) update[f] = req.body[f];
  }

  const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
  res.json({ success: true, user });
});

/**
 * Upload de avatar (foto de perfil). Aceita imagem via multipart 'file'.
 */
exports.uploadMyAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Envie uma imagem no campo "file"', 400);

  if (!req.file.mimetype.startsWith('image/')) {
    throw new AppError('Apenas imagens são permitidas', 400);
  }

  const user = await User.findById(req.user._id);
  if (!user) throw new AppError('Usuário não encontrado', 404);

  // Se já tinha avatar antigo armazenado, tenta deletar
  if (user.avatarMeta) {
    try { await storageService.deleteFile(user.avatarMeta); } catch (_) {}
  }

  const meta = await storageService.uploadFile(req.file, `avatars/${user._id}`);
  user.avatarUrl = meta.url;
  user.avatarMeta = meta; // guarda info pra poder excluir depois
  await user.save();

  res.json({ success: true, user });
});

/**
 * Remove avatar do próprio usuário.
 */
exports.removeMyAvatar = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError('Usuário não encontrado', 404);

  if (user.avatarMeta) {
    try { await storageService.deleteFile(user.avatarMeta); } catch (_) {}
  }
  user.avatarUrl = '';
  user.avatarMeta = null;
  await user.save();

  res.json({ success: true, user });
});

/**
 * Trocar a própria senha (precisa da senha atual para validar).
 */
exports.changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new AppError('Informe a senha atual e a nova senha', 400);
  }
  if (newPassword.length < 6) {
    throw new AppError('A nova senha deve ter no mínimo 6 caracteres', 400);
  }

  const user = await User.findById(req.user._id).select('+password');
  const ok = await user.comparePassword(currentPassword);
  if (!ok) throw new AppError('Senha atual incorreta', 401);

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Senha alterada com sucesso' });
});