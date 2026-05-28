const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { getPagination, paginate } = require('../utils/paginate');

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
