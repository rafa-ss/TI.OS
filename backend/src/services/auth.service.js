const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const loginAttempts = require('./loginAttempts.service');

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function fmtTime(seconds) {
  if (seconds <= 60) return `${seconds} segundo(s)`;
  const m = Math.ceil(seconds / 60);
  return `${m} minuto(s)`;
}

async function login(email, password) {
  // 1) Está bloqueado por excesso de tentativas?
  const lock = loginAttempts.getLockStatus(email);
  if (lock.locked) {
    throw new AppError(
      `Muitas tentativas de login falhadas. Tente novamente em ${fmtTime(lock.secondsLeft)}.`,
      429
    );
  }

  // 2) Tenta validar credenciais
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    const f = loginAttempts.registerFailure(email);
    if (f.justLocked) {
      throw new AppError(
        `Muitas tentativas falhadas. Conta bloqueada por ${fmtTime(f.lockSeconds)}.`,
        429
      );
    }
    throw new AppError(
      `Credenciais inválidas. Restam ${f.remaining} tentativa(s) antes do bloqueio.`,
      401
    );
  }

  if (!user.active) throw new AppError('Usuário desativado', 403);

  const ok = await user.comparePassword(password);
  if (!ok) {
    const f = loginAttempts.registerFailure(email);
    if (f.justLocked) {
      throw new AppError(
        `Muitas tentativas falhadas. Conta bloqueada por ${fmtTime(f.lockSeconds)}.`,
        429
      );
    }
    throw new AppError(
      `Credenciais inválidas. Restam ${f.remaining} tentativa(s) antes do bloqueio.`,
      401
    );
  }

  // 3) Login OK — limpa as tentativas
  loginAttempts.clear(email);

  user.lastLoginAt = new Date();
  await user.save();

  return {
    token: signToken(user),
    user: user.toJSON(),
  };
}

module.exports = { login, signToken };
