const mongoose = require('mongoose');
const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { connectDatabase } = require('./config/database');
const { ensureAdmin, ensureDefaultKits, syncTermCounters, syncAllStations, backfillOrderDueDates } = require('./utils/seed');
const { run: renumberTerms } = require('./utils/renumberTerms2026');

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

      // Recontagem/renumeração automática dos Termos de Entrega por ANO DE
      // MONTAGEM (assemblyDate → createdAt). Corrige termos com ano/sequência
      // errados e mantém a numeração compacta (01/AAAA, 02/AAAA...).
      // Pode ser desativada via DISABLE_TERM_RENUMBER=true no .env.
      if (env.DISABLE_TERM_RENUMBER !== true) {
        try {
          const result = await renumberTerms(
            { apply: true, years: null },
            { log: () => {} } // silencioso (sem poluir o boot)
          );
          if (result.applied && result.changes?.length) {
            logger.info(`[boot] Termos de entrega renumerados: ${result.changes.length} corrigido(s) de ${result.total}.`);
          } else {
            logger.info(`[boot] Termos de entrega: numeração já consistente (${result.total} termo(s)).`);
          }
        } catch (e) {
          logger.warn(`[boot] Falha na renumeração de termos: ${e.message}`);
        }
      }

      await syncTermCounters();
      await syncAllStations();
      await backfillOrderDueDates();
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
