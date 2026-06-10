/**
 * Numeração automática dos Termos de Entrega de Laboratório.
 *
 * Formato: NN/AAAA  (ex.: 01/2026, 02/2026, ... 99/2026, 100/2026)
 *
 * Garantias:
 *  - Sequencial por ANO (reinicia em 01 a cada ano novo).
 *  - 100% gerado no backend (o usuário nunca digita).
 *  - À prova de concorrência: usa o Counter atômico ($inc + upsert),
 *    então dois usuários simultâneos NUNCA recebem o mesmo número.
 *  - Anti-duplicidade: após gerar um candidato, confere no banco; se já
 *    existir (ex.: dados legados/migração), avança o contador até achar um
 *    número livre.
 *  - Migração automática (self-healing): se o contador estiver "atrás" dos
 *    números já cadastrados naquele ano, ele é sincronizado com o maior
 *    número existente antes de gerar — assim a sequência CONTINUA de onde
 *    parou, sem duplicar e sem pular indevidamente.
 */
const Counter = require('../models/Counter');
const Laboratory = require('../models/Laboratory');

const counterId = (year) => `lab_term_${year}`;

/** Formata "1" + 2026 -> "01/2026" (mínimo 2 dígitos no sequencial). */
function formatTermNumber(seq, year) {
  return `${String(seq).padStart(2, '0')}/${year}`;
}

/** Extrai { seq, year } de "15/2026". Retorna null se não casar o formato. */
function parseTermNumber(value) {
  const m = String(value || '').trim().match(/^(\d{1,})\s*\/\s*(\d{4})$/);
  if (!m) return null;
  return { seq: parseInt(m[1], 10), year: parseInt(m[2], 10) };
}

/**
 * Descobre o maior número sequencial já cadastrado em `deliveryTermNumber`
 * para um determinado ano (varre os labs que terminam em "/AAAA").
 */
async function maxExistingSeqForYear(year) {
  const labs = await Laboratory.find({
    deliveryTermNumber: { $regex: `/${year}$` },
  }).select('deliveryTermNumber').lean();

  let max = 0;
  for (const lab of labs) {
    const parsed = parseTermNumber(lab.deliveryTermNumber);
    if (parsed && parsed.year === year && parsed.seq > max) max = parsed.seq;
  }
  return max;
}

/**
 * Sincroniza o contador do ano com o maior número já existente, caso o
 * contador esteja atrás. Idempotente e seguro (só sobe, nunca desce).
 * É a peça que garante a MIGRAÇÃO: continua a sequência a partir do último
 * termo já cadastrado em cada ano.
 */
async function syncCounterToExisting(year) {
  const max = await maxExistingSeqForYear(year);
  if (max <= 0) return;
  const current = await Counter.findById(counterId(year)).lean();
  if (!current || (current.seq || 0) < max) {
    await Counter.findByIdAndUpdate(
      counterId(year),
      { $max: { seq: max } },     // $max: só atualiza se o novo valor for maior
      { new: true, upsert: true }
    );
  }
}

/**
 * Gera o PRÓXIMO número de termo para o ano informado (default: ano atual).
 * Atômico + anti-duplicidade + auto-sincronização com dados existentes.
 *
 * @param {number} [year] ano de referência (default: ano atual do servidor)
 * @returns {Promise<string>} número no formato "NN/AAAA"
 */
async function generateTermNumber(year = new Date().getFullYear()) {
  // 1) Garante que o contador esteja alinhado com o que já existe (migração).
  await syncCounterToExisting(year);

  // 2) Gera atomicamente e confere duplicidade (defensivo).
  let attempts = 0;
  while (attempts < 100) {
    const seq = await Counter.next(counterId(year)); // atômico ($inc + upsert)
    const candidate = formatTermNumber(seq, year);
    const exists = await Laboratory.findOne({ deliveryTermNumber: candidate })
      .select('_id').lean();
    if (!exists) return candidate;
    attempts += 1;
  }
  throw new Error('Não foi possível gerar um número de termo único após 100 tentativas');
}

module.exports = {
  formatTermNumber,
  parseTermNumber,
  maxExistingSeqForYear,
  syncCounterToExisting,
  generateTermNumber,
  counterId,
};
