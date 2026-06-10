/**
 * Script de DIAGNÓSTICO (somente leitura): mostra como os Termos de Entrega
 * estão realmente gravados no banco, para entender por que a renumeração não
 * encontrou termos de 2026.
 *
 * Rodar (dentro de backend/):  node src/utils/inspectTerms.js
 */
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const Laboratory = require('../models/Laboratory');

async function main() {
  await connectDatabase();
  if (mongoose.connection.readyState !== 1) {
    console.error('❌ Não foi possível conectar ao MongoDB. Verifique MONGODB_URI no .env');
    process.exit(1);
  }

  try {
    const total = await Laboratory.countDocuments();
    console.log(`\n📊 Total de laboratórios no banco: ${total}`);

    // Lista TODOS com o que tiver no campo deliveryTermNumber
    const labs = await Laboratory.find({})
      .select('_id name deliveryTermNumber assemblyDate completionDate createdAt status')
      .sort({ createdAt: 1 })
      .lean();

    const comNumero = labs.filter((l) => l.deliveryTermNumber && String(l.deliveryTermNumber).trim() !== '');
    const semNumero = labs.filter((l) => !l.deliveryTermNumber || String(l.deliveryTermNumber).trim() === '');

    console.log(`   • Com deliveryTermNumber preenchido: ${comNumero.length}`);
    console.log(`   • Sem deliveryTermNumber (vazio/null): ${semNumero.length}`);

    console.log('\n──────────── TERMOS PREENCHIDOS (valor exato entre aspas) ────────────');
    if (comNumero.length === 0) {
      console.log('  (nenhum)');
    } else {
      for (const l of comNumero) {
        const montagem = l.assemblyDate ? new Date(l.assemblyDate).toISOString().slice(0, 10) : '—';
        const criado = l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : '—';
        console.log(`  "${l.deliveryTermNumber}"  | montagem ${montagem} | criado ${criado} | ${l.name}`);
      }
    }

    // Distribuição por "ano" tentando extrair de várias formas
    console.log('\n──────────── ANÁLISE DE FORMATO ────────────');
    const formatos = {};
    for (const l of comNumero) {
      const v = String(l.deliveryTermNumber).trim();
      let chave;
      if (/^\d{1,}\/\d{4}$/.test(v)) chave = 'NN/AAAA (ex.: 01/2026)';
      else if (/^\d{1,}-\d{4}$/.test(v)) chave = 'NN-AAAA (hífen)';
      else if (/^\d{4}\/\d{1,}$/.test(v)) chave = 'AAAA/NN (invertido)';
      else if (/\d{4}/.test(v)) chave = 'contém um ano, formato diferente';
      else chave = 'sem ano reconhecível';
      formatos[chave] = (formatos[chave] || 0) + 1;
    }
    for (const [k, n] of Object.entries(formatos)) console.log(`  ${n.toString().padStart(3)} × ${k}`);

    // Mostra labs SEM número mas que talvez sejam de 2026 (montagem/criação)
    const candidatos2026 = semNumero.filter((l) => {
      const y = new Date(l.assemblyDate || l.createdAt || 0).getFullYear();
      return y === 2026;
    });
    if (candidatos2026.length > 0) {
      console.log(`\n⚠️  ${candidatos2026.length} laboratório(s) de 2026 SEM número de termo (montagem/criação em 2026):`);
      for (const l of candidatos2026) {
        const montagem = l.assemblyDate ? new Date(l.assemblyDate).toISOString().slice(0, 10) : '—';
        const criado = l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : '—';
        console.log(`   - ${l.name} | montagem ${montagem} | criado ${criado} | status ${l.status}`);
      }
    }

    console.log('');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error('💥 Erro:', err.message);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  });
}
