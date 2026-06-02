require('dotenv').config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim()),

  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/os_abaetetuba',

  JWT_SECRET: process.env.JWT_SECRET || 'change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
  SUPABASE_BUCKET: process.env.SUPABASE_BUCKET || 'os-files',

  UPLOAD_MAX_SIZE_MB: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '10', 10),
  UPLOAD_LOCAL_DIR: process.env.UPLOAD_LOCAL_DIR || 'uploads',

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),

 SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME || 'Administrador',
 SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL || 'admin@semec.abaetetuba.pa.gov.br',
 SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
};

module.exports = env;
