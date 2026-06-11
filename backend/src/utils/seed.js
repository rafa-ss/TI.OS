const mongoose = require('mongoose');
const env = require('../config/env');
const User = require('../models/User');
const Kit = require('../models/Kit');
const Laboratory = require('../models/Laboratory');
const logger = require('./logger');
const { connectDatabase } = require('../config/database');
const { syncCounterToExisting, parseTermNumber } = require('../services/termNumber.service');

async function ensureAdmin() {
  const existing = await User.findOne({ email: env.SEED_ADMIN_EMAIL });
  if (existing) {
    logger.info(`[seed] admin já existe: ${existing.email}`);
    return existing;
  }
  const admin = await User.create({
    name: env.SEED_ADMIN_NAME,
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
    role: 'admin',
    active: true,
  });
  logger.info(`[seed] admin criado: ${admin.email} / senha: ${env.SEED_ADMIN_PASSWORD}`);
  return admin;
}

/**
 * Garante a existência dos kits padrão (idempotente: cria só os que faltam,
 * identificando pelo slug). Não sobrescreve kits já editados pelo admin.
 */
const DEFAULT_KITS = [
  {
    name: 'Computador Completo',
    description: 'CPU + Monitor + Mouse + Teclado',
    icon: 'Monitor',
    components: [
      { type: 'computador', condition: 'novo', quantityPerKit: 1 },
      { type: 'monitor', condition: 'novo', quantityPerKit: 1 },
      { type: 'mouse', condition: 'novo', quantityPerKit: 1 },
      { type: 'teclado', condition: 'novo', quantityPerKit: 1 },
    ],
  },
  
];

async function ensureDefaultKits() {
  let created = 0;
  for (const def of DEFAULT_KITS) {
    const slug = Kit.makeSlug(def.name);
    const exists = await Kit.findOne({ slug });
    if (exists) continue;
    await Kit.create({ ...def, slug, active: true });
    created += 1;
  }
  if (created > 0) logger.info(`[seed] ${created} kit(s) padrão criado(s)`);
  else logger.info('[seed] kits padrão já existem');
}

/**
 * MIGRAÇÃO da numeração dos Termos de Entrega.
 * Para cada ANO presente nos termos já cadastrados, sincroniza o contador
 * com o maior número existente — assim a sequência CONTINUA automaticamente
 * a partir do último termo cadastrado em cada ano (sem duplicar, sem perder
 * os termos antigos). Idempotente e seguro (só sobe o contador).
 */
async function syncTermCounters() {
  // Descobre todos os anos presentes em deliveryTermNumber
  const numeros = await Laboratory.find({
    deliveryTermNumber: { $type: 'string', $gt: '' },
  }).select('deliveryTermNumber').lean();

  const years = new Set();
  for (const lab of numeros) {
    const parsed = parseTermNumber(lab.deliveryTermNumber);
    if (parsed) years.add(parsed.year);
  }

  let synced = 0;
  for (const year of years) {
    await syncCounterToExisting(year);
    synced += 1;
  }
  if (synced > 0) logger.info(`[seed] contador de termos sincronizado p/ ${synced} ano(s): ${[...years].join(', ')}`);
  else logger.info('[seed] nenhum termo existente para sincronizar (começará em 01)');
}

/**
 * Backfill: gera as estações (PC01..PCnn) para laboratórios que ainda não
 * têm o array `stations` sincronizado com a quantidade de computadores.
 * Idempotente.
 */
async function syncAllStations() {
  const stationService = require('../services/station.service');
  const labs = await Laboratory.find({ kind: 'laboratorio' });
  let touched = 0;
  for (const lab of labs) {
    const before = (lab.stations || []).length;
    stationService.syncStations(lab);
    if ((lab.stations || []).length !== before || before === 0) {
      stationService.recomputeComputerStatus(lab);
      await lab.save();
      touched++;
    }
  }
  if (touched > 0) logger.info(`[seed] estações sincronizadas em ${touched} laboratório(s)`);
  else logger.info('[seed] estações já sincronizadas');
}

async function runSeed() {
  await connectDatabase();
  await ensureAdmin();
  await ensureDefaultKits();
  await syncTermCounters();
  await syncAllStations();
  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  runSeed().catch((err) => {
    logger.error(err);
    process.exit(1);
  });
}

module.exports = { ensureAdmin, ensureDefaultKits, syncTermCounters, syncAllStations };
