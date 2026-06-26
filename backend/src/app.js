const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const routes = require('./routes');
const { getUploadDirs } = require('./utils/uploadPaths');
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

// Logs — pula as rotas de polling do chat para não poluir o terminal
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined', {
    skip: (req) => {
      const url = req.originalUrl || req.url || '';
      return (
        url.includes('/chat/contacts') ||
        url.includes('/chat/messages') ||
        url.includes('/chat/unread') ||
        url.includes('/chat/read') ||
        url.includes('/chat/presence') ||
        url.includes('/notifications')
      );
    },
  }));
}

// Rate limit (apenas API)
// O /chat usa polling frequente (a cada 5-10s), então é excluído do limite.
app.use(
  env.API_PREFIX,
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/chat'),
    message: { success: false, message: 'Muitas requisições. Tente novamente mais tarde.' },
  })
);

// Uploads locais (fallback quando Supabase não configurado)
// Serve o diretório canônico e também caminhos legados, para não quebrar
// anexos antigos salvos quando o backend foi iniciado de outro diretório.
getUploadDirs().forEach((dir) => {
  app.use('/uploads', express.static(dir));
});

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
