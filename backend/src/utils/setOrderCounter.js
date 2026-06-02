/**
 * Ajusta o contador de Ordens de Serviço para começar a partir de um número.
 *
 * Uso:
 *   node src/utils/setOrderCounter.js 15           # próxima O.S. será 15/ano-atual
 *   node src/utils/setOrderCounter.js 15 2026      # próxima O.S. será 15/2026
 *
 * Formato gerado: NN/YYYY  (ex.: 15/2026)
 */
const mongoose = require('mongoose');
const env = require('../config/env');
const Counter = require('../models/Counter');

async function run() {
  const target = parseInt(process.argv[2], 10);
  const year = parseInt(process.argv[3] || new Date().getFullYear(), 10);

  if (!target || target < 1) {
    console.error('❌ Uso: node src/utils/setOrderCounter.js <numero> [ano]');
    console.error('   Ex.: node src/utils/setOrderCounter.js 15');
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Conectado ao MongoDB`);

  const counterId = `os_${year}`;
  const newSeq = target - 1; // o próximo .next() retornará newSeq + 1 = target

  const result = await Counter.findByIdAndUpdate(
    counterId,
    { $set: { seq: newSeq } },
    { upsert: true, new: true }
  );

  console.log(`✅ Contador "${counterId}" ajustado.`);
  console.log(`   Próxima O.S. criada em ${year} será: ${String(target).padStart(2, '0')}/${year}`);
  console.log(`   (valor interno do contador: ${result.seq})`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('💥 Erro:', err.message);
  process.exit(1);
});
