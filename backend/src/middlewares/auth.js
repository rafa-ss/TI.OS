const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const User = require('../models/User');

async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError('Token não enviado', 401);

    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.sub);
    if (!user || !user.active) throw new AppError('Usuário inválido ou inativo', 401);

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new AppError('Token inválido ou expirado', 401));
    }
    next(err);
  }
}

/**
 * Middleware RBAC. Aceita lista de roles.
 * Ex.: authorize('admin'), authorize('admin','tecnico')
 */
function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError('Não autenticado', 401));
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new AppError('Acesso negado para este perfil', 403));
    }
    next();
  };
}

module.exports = { authenticate, authorize };
