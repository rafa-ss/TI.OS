const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

mongoose.set('strictQuery', true);

async function connectDatabase() {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 10000,
    });
    logger.info(`[MongoDB] conectado em ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    logger.error(`[MongoDB] erro de conexão: ${err.message}`);
    // Não derruba o servidor em dev - permite iniciar mesmo sem mongo
    if (env.NODE_ENV === 'production') process.exit(1);
  }

  mongoose.connection.on('disconnected', () => logger.warn('[MongoDB] desconectado'));
  mongoose.connection.on('reconnected', () => logger.info('[MongoDB] reconectado'));
}

module.exports = { connectDatabase };
