const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// 404
function notFound(req, _res, next) {
  next(new AppError(`Rota não encontrada: ${req.method} ${req.originalUrl}`, 404));
}

// Erros globais
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Erro interno do servidor';
  let details = err.details || null;

  // Mongoose validation
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Erro de validação';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }

  if (err.name === 'CastError') {
    status = 400;
    message = `Valor inválido para o campo ${err.path}`;
  }

  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = `Registro duplicado${field ? `: ${field}` : ''}`;
    details = err.keyValue;
  }

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${err.stack || err.message}`);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${status} ${message}`);
  }

  res.status(status).json({
    success: false,
    message,
    details,
  });
}

module.exports = { notFound, errorHandler };
