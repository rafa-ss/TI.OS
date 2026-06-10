/**
 * Script: renumberTerms2026.js  (renumeração por ANO DE MONTAGEM)
 * ----------------------------------------------------------------------------
 * Corrige a numeração dos Termos de Entrega reagrupando-os pelo ANO REAL DA
 * MONTAGEM (assemblyDate; quando vazia, usa createdAt) e renumerando cada ano
 * de forma sequencial e SEM FUROS: 01/AAAA, 02/AAAA, 03/AAAA...
 *
 * Motivação: alguns termos ficaram com o ano errado no número (ex.: "14/2025"
 * mas montados em 2026). Este script põe cada termo no ano correto e compacta
 * a sequência de TODOS os anos envolvidos.
 *
 * Ordem dentro de cada ano: data de montagem (asc) → createdAt → _id (estável).
 *
 * Ao final, sincroniza o contador (lab_term_AAAA) de cada ano para que a
 * geração AUTOMÁTICA continue do próximo número correto.
 *
 * Segurança:
 *  - DRY RUN por padrão (só mostra o de/para). Use --apply para gravar.
 *  - Renumeração em DUAS FASES (número temporário → final) para nunca violar
 *    o índice único `uniq_deliveryTermNumber` durante a troca.
 *
 * Como rodar (dentro de backend/):
 *   Pré-visualizar:   node src/utils/renumberTerms2026.js
 *   Aplicar:          node src/utils/renumberTerms2026.js --apply
 *
 *   Limitar a anos específicos (default: todos os anos presentes):
 *                     node src/utils/renumberTerms2026.js --apply --years=2025,2026
 * ----------------------------------------------------------------------------
 */
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const Laboratory = require('../models/Laboratory');
const Counter = require('../models/Counter');
const { formatTermNumber, counterId } = require('../services/termNumber.service');

function parseArgs(argv) {
  const args = (argv || process.argv).slice(2);
  const out = { apply: false, years: null };
  for (const a of args) {
    if (a === '--apply') out.apply = true;
    else if (a.startsWith('--years=')) {
      out.years = a.split('=')[1].split(',').map((y) => parseInt(y.trim(), 10)).filter(Number.isFinite);
    }
  }
  return out;
}

/** Data usada para ordenar/agrupar: assemblyDate > createdAt. */
function refDate(lab) {
  return new Date(lab.assemblyDate || lab.createdAt || 0);
}
function refYear(lab) {
  return refDate(lab).getFullYear();
}

async function run(opts, { log = console.log } = {}) {
  const { apply } = opts;

  log('\n=== Renumeração de Termos de Entrega (por ano de montagem) ===');
  log('Critério: ano = data de montagem (assemblyDate → createdAt)');
  log('Ordem:    data de montagem (asc) dentro de cada ano');
  log('Modo:    ', apply ? '🟢 APLICAR (vai gravar)' : '🟡 DRY RUN (apenas pré-visualização)');

  // Pega TODOS os labs com termo preenchido
  const labs = await Laboratory.find({
    deliveryTermNumber: { $type: 'string', $gt: '' },
  }).select('_id name deliveryTermNumber assemblyDate createdAt').lean();

  if (labs.length === 0) {
    log('\nNenhum termo encontrado. Nada a fazer.');
    return { applied: false, total: 0, changes: [] };
  }

  // Agrupa por ano da montagem
  const byYear = new Map();
  for (const lab of labs) {
    const y = refYear(lab);
    if (opts.years && !opts.years.includes(y)) continue; // filtro opcional
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(lab);
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);

  // Monta o plano de/para por ano
  const plan = [];
  for (const year of years) {
    const group = byYear.get(year);
    group.sort((a, b) => {
      const da = refDate(a).getTime(), db = refDate(b).getTime();
      if (da !== db) return da - db;
      const ca = new Date(a.createdAt || 0).getTime();
      const cb = new Date(b.createdAt || 0).getTime();
      if (ca !== cb) return ca - cb;
      return String(a._id).localeCompare(String(b._id));
    });
    group.forEach((lab, i) => {
      plan.push({
        _id: lab._id,
        name: lab.name,
        year,
        from: lab.deliveryTermNumber,
        to: formatTermNumber(i + 1, year),
        assembly: lab.assemblyDate ? new Date(lab.assemblyDate).toISOString().slice(0, 10) : '—',
      });
    });
  }

  const changes = plan.filter((p) => p.from !== p.to);

  log(`\nTotal de termos: ${plan.length} | Anos: ${years.join(', ')}`);
  log(`Termos que MUDARÃO: ${changes.length}\n`);
  log('  Montagem    De        →  Para       Laboratório');
  log('  ----------  --------     --------   -----------');
  for (const p of plan) {
    const mark = p.from !== p.to ? '✏️ ' : '   ';
    log(`  ${p.assembly}  ${String(p.from).padEnd(8)} →  ${String(p.to).padEnd(8)} ${mark}${p.name}`);
  }

  // Resumo por ano
  log('\n  Resumo por ano:');
  for (const year of years) {
    const n = plan.filter((p) => p.year === year).length;
    log(`   • ${year}: ${n} termo(s) → 01/${year} até ${formatTermNumber(n, year)} | próximo automático: ${formatTermNumber(n + 1, year)}`);
  }

  if (!apply) {
    log('\n[DRY RUN] Nada foi alterado. Rode novamente com --apply para gravar.\n');
    return { applied: false, total: plan.length, changes };
  }

  // ===== FASE 1: números TEMPORÁRIOS (evita colisão com índice único) =====
  for (let i = 0; i < plan.length; i++) {
    await Laboratory.updateOne(
      { _id: plan[i]._id },
      { $set: { deliveryTermNumber: `__tmp__-${i}` } }
    );
  }

  // ===== FASE 2: números FINAIS =====
  for (const p of plan) {
    await Laboratory.updateOne(
      { _id: p._id },
      { $set: { deliveryTermNumber: p.to } }
    );
  }

  // ===== Sincroniza o contador de cada ano =====
  for (const year of years) {
    const n = plan.filter((p) => p.year === year).length;
    await Counter.findByIdAndUpdate(
      counterId(year),
      { $set: { seq: n } },
      { new: true, upsert: true }
    );
  }

  log(`\n✅ ${plan.length} termo(s) renumerado(s) com sucesso.`);
  for (const year of years) {
    const n = plan.filter((p) => p.year === year).length;
    log(`   • ${year}: 01/${year}..${formatTermNumber(n, year)} | contador "${counterId(year)}" = ${n} | próximo: ${formatTermNumber(n + 1, year)}`);
  }
  log('');

  return { applied: true, total: plan.length, changes, years };
}

async function main() {
  const opts = parseArgs();
  await connectDatabase();
  if (mongoose.connection.readyState !== 1) {
    console.error('❌ Não foi possível conectar ao MongoDB. Verifique MONGODB_URI no .env');
    process.exit(1);
  }
  try {
    await run(opts);
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { parseArgs, run, refYear, refDate };

if (require.main === module) {
  main().catch(async (err) => {
    console.error('💥 Erro:', err.message);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  });
}
