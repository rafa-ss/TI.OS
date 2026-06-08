/**
 * Script: resetLabTermCounter.js
 * --------------------------------
 * Zera o contador do Termo de Entrega de Laboratório do ano corrente,
 * pra que o próximo termo gerado seja "01/AAAA".
 *
 * Como rodar (no Windows, dentro de backend/):
 *
 *   Dry run (só mostra o que vai fazer):
 *     node src/utils/resetLabTermCounter.js
 *
 *   Aplicar (zera contador + limpa deliveryTermNumber dos labs):
 *     node src/utils/resetLabTermCounter.js --apply
 *
 *   Ano específico (default: ano atual):
 *     node src/utils/resetLabTermCounter.js --apply --year=2026
 *
 *   Começar de um número específico (default: 0 → próximo será 1):
 *     node src/utils/resetLabTermCounter.js --apply --start=0
 *     node src/utils/resetLabTermCounter.js --apply --start=5    (próximo será 6)
 *
 *   Preservar números antigos (NÃO limpa labs já com número):
 *     node src/utils/resetLabTermCounter.js --apply --keep-existing
 *
 * IMPORTANTE: o `--apply` (sem --keep-existing) também LIMPA o campo
 * `deliveryTermNumber` dos laboratórios existentes do ano. Assim, quando
 * você baixar o PDF/DOCX de qualquer lab, ele vai gerar um número NOVO
 * a partir de 01.
 */
const Counter = require('../models/Counter');
const Laboratory = require('../models/Laboratory');

function parseArgs(argv) {
  const args = (argv || process.argv).slice(2);
  const out = { apply: false, year: new Date().getFullYear(), start: 0, keepExisting: false };
  for (const a of args) {
    if (a === '--apply') out.apply = true;
    else if (a === '--keep-existing') out.keepExisting = true;
    else if (a.startsWith('--year=')) out.year = parseInt(a.split('=')[1], 10);
    else if (a.startsWith('--start=')) out.start = parseInt(a.split('=')[1], 10);
  }
  if (!Number.isFinite(out.year)) out.year = new Date().getFullYear();
  if (!Number.isFinite(out.start) || out.start < 0) out.start = 0;
  return out;
}

async function run(opts, { log = console.log } = {}) {
  const counterId = `lab_term_${opts.year}`;
  const next = opts.start + 1;

  log('\n=== Reset do contador do Termo de Entrega ===');
  log('Ano:                 ', opts.year);
  log('Contador (Mongo _id):', counterId);
  log('Novo valor (seq):    ', opts.start, '→ próximo termo será:', `${String(next).padStart(2, '0')}/${opts.year}`);
  log('Modo:                ', opts.apply ? 'APLICAR' : 'DRY RUN (só mostra)');
  log('Limpar labs:         ', opts.keepExisting ? 'NÃO (preservar)' : 'SIM (limpar deliveryTermNumber)');
  log('');

  const current = await Counter.findById(counterId);
  log(`Estado atual do contador: ${current ? current.seq : '(não existe ainda)'}`);

  const labsComNumero = await Laboratory.find({
    deliveryTermNumber: { $regex: `/${opts.year}$` },
  }).select('_id name deliveryTermNumber').sort({ deliveryTermNumber: 1 });

  log(`\nLaboratórios com termo já emitido em ${opts.year}: ${labsComNumero.length}`);
  for (const lab of labsComNumero) {
    log(`  ${lab.deliveryTermNumber}  →  ${lab.name}`);
  }

  if (!opts.apply) {
    log('\n[DRY RUN] Nenhuma alteração feita. Rode novamente com --apply pra aplicar.');
    return { applied: false, counter: current?.seq || 0, labsCleared: 0 };
  }

  await Counter.findByIdAndUpdate(
    counterId,
    { $set: { seq: opts.start } },
    { new: true, upsert: true }
  );
  log(`\n✅ Contador "${counterId}" zerado para ${opts.start}.`);

  let cleared = 0;
  if (!opts.keepExisting && labsComNumero.length > 0) {
    const ids = labsComNumero.map((l) => l._id);
    const r = await Laboratory.updateMany(
      { _id: { $in: ids } },
      { $set: { deliveryTermNumber: '' } }
    );
    cleared = r.modifiedCount;
    log(`✅ Campo deliveryTermNumber limpo em ${cleared} laboratório(s).`);
    log('   → Da próxima vez que você baixar o PDF/DOCX desses labs, eles ganharão NOVOS números a partir de 01.');
  } else if (opts.keepExisting) {
    log('ℹ️  Labs antigos preservados (não foi mexido em deliveryTermNumber).');
    log('   → ATENÇÃO: pode dar número duplicado se você não limpar manualmente.');
  }

  log(`\n🎉 Pronto! O próximo termo de entrega gerado será: ${String(next).padStart(2, '0')}/${opts.year}\n`);
  return { applied: true, counter: opts.start, labsCleared: cleared };
}

async function main() {
  require('dotenv').config();
  const mongoose = require('mongoose');
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ Variável MONGO_URI não encontrada no .env');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
  console.log('✅ Conectado ao MongoDB');
  try {
    await run(parseArgs());
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { parseArgs, run };

if (require.main === module) {
  main().catch(async (err) => {
    console.error('💥 Erro:', err.message);
    try { await require('mongoose').disconnect(); } catch {}
    process.exit(1);
  });
}
