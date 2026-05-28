const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/AppError');

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

async function login(email, password) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) throw new AppError('Credenciais inválidas', 401);
  if (!user.active) throw new AppError('Usuário desativado', 403);

  const ok = await user.comparePassword(password);
  if (!ok) throw new AppError('Credenciais inválidas', 401);

  user.lastLoginAt = new Date();
  await user.save();

  return {
    token: signToken(user),
    user: user.toJSON(),
  };
}

module.exports = { login, signToken };
