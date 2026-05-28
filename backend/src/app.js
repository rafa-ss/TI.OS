const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const path = require('path');

const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.set('trust proxy', 1);

// Security
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (env.CORS_ORIGIN.includes('*') || env.CORS_ORIGIN.includes(origin)) {
        return cb(null, true);
      }
      return cb(null, true); // permissivo por padrão para facilitar dev
    },
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Sanitização e compressão
app.use(mongoSanitize());
app.use(compression());

// Logs
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
}

// Rate limit (apenas API)
app.use(
  env.API_PREFIX,
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Muitas requisições. Tente novamente mais tarde.' },
  })
);

// Uploads locais (fallback quando Supabase não configurado)
app.use('/uploads', express.static(path.resolve(env.UPLOAD_LOCAL_DIR)));

// Health raiz
app.get('/', (_req, res) => {
  res.json({
    success: true,
    service: 'OS Abaetetuba - API',
    version: '1.0.0',
    docs: `${env.API_PREFIX}/health`,
  });
});

app.use(env.API_PREFIX, routes);

// 404 e erros
app.use(notFound);
app.use(errorHandler);

module.exports = app;
