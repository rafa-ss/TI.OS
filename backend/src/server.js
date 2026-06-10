const mongoose = require('mongoose');
const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { connectDatabase } = require('./config/database');
const { ensureAdmin, ensureDefaultKits, syncTermCounters } = require('./utils/seed');

async function bootstrap() {
  // Inicia o HTTP imediatamente — não trava sem Mongo
  app.listen(env.PORT, () => {
    logger.info(`🚀 API rodando em http://localhost:${env.PORT}${env.API_PREFIX}`);
    logger.info(`Ambiente: ${env.NODE_ENV}`);
  });

  // Conexão com o banco e seed do admin em background
  await connectDatabase();

  if (mongoose.connection.readyState === 1) {
    try {
      await ensureAdmin();
      await ensureDefaultKits();
      await syncTermCounters();
    } catch (err) {
      logger.warn(`[seed] não foi possível garantir admin/kits/contadores: ${err.message}`);
    }
  } else {
    logger.warn('[boot] API no ar, mas MongoDB indisponível — configure MONGODB_URI no .env');
  }
}

bootstrap();

process.on('unhandledRejection', (reason) => {
  logger.error(`UnhandledRejection: ${reason}`);
});

process.on('uncaughtException', (err) => {
  logger.error(`UncaughtException: ${err.message}`);
});
