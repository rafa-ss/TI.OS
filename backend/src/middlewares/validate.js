const AppError = require('../utils/AppError');

/**
 * Middleware genérico de validação usando zod schemas.
 * Uso: validate({ body: schema, query: schema, params: schema })
 */
module.exports = (schemas) => (req, _res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) req.query = schemas.query.parse(req.query);
    if (schemas.params) req.params = schemas.params.parse(req.params);
    next();
  } catch (err) {
    const details = err.errors?.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    next(new AppError('Erro de validação', 400, details));
  }
};
