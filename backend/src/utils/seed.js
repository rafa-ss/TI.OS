const mongoose = require('mongoose');
const env = require('../config/env');
const User = require('../models/User');
const logger = require('./logger');
const { connectDatabase } = require('../config/database');

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

async function runSeed() {
  await connectDatabase();
  await ensureAdmin();
  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  runSeed().catch((err) => {
    logger.error(err);
    process.exit(1);
  });
}

module.exports = { ensureAdmin };
