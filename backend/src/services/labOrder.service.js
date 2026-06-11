/**
 * Serviço de integração entre Ordens de Serviço e Laboratórios.
 * Centraliza os efeitos colaterais quando uma OS é de manutenção de laboratório.
 */
const Laboratory = require('../models/Laboratory');
const ServiceOrder = require('../models/ServiceOrder');
const stationService = require('./station.service');

const LAB_SERVICE_TYPES = ['manutencao_preventiva', 'manutencao_corretiva'];

function isLabOrder(body) {
  return !!body.laboratory && LAB_SERVICE_TYPES.includes(body.serviceType);
}

/**
 * Normaliza os campos de laboratório vindos do body de criação/edição.
 * Valida o laboratório e as estações informadas (resolvendo o code de cada uma).
 * Retorna o objeto pronto pra mesclar no documento da OS.
 */
async function normalizeLabFields(body) {
  const out = {};
  if (!body.laboratory) return out;

  const lab = await Laboratory.findById(body.laboratory).select('name stations school');
  if (!lab) throw new Error('Laboratório informado não existe');

  out.laboratory = lab._id;

  // Estações: aceita array de codes ("PC05") ou de ids; resolve contra o lab.
  const wanted = Array.isArray(body.stations) ? body.stations : [];
  const resolved = [];
  for (const w of wanted) {
    const code = typeof w === 'string' ? w : (w.code || '');
    const id = typeof w === 'object' ? w.stationId : null;
    const st = lab.stations.find(s =>
      (id && String(s._id) === String(id)) || (code && s.code === code));
    if (st) resolved.push({ stationId: st._id, code: st.code });
  }
  out.stations = resolved;

  // Checklists (filtra só itens válidos)
  if (Array.isArray(body.preventiveChecklist)) {
    out.preventiveChecklist = body.preventiveChecklist.filter(i => ServiceOrder.PREVENTIVE_ITEMS.includes(i));
  }
  if (Array.isArray(body.correctiveChecklist)) {
    out.correctiveChecklist = body.correctiveChecklist.filter(i => ServiceOrder.CORRECTIVE_ITEMS.includes(i));
  }

  // Garante coerência da escola (a OS de lab herda a escola do laboratório)
  if (lab.school) out.school = lab.school;

  return out;
}

/**
 * Ao ABRIR uma OS de laboratório: marca as estações afetadas como "manutencao"
 * e registra no histórico do laboratório.
 */
async function onOrderOpened(os, user) {
  if (!os.laboratory || !LAB_SERVICE_TYPES.includes(os.serviceType)) return;
  const lab = await Laboratory.findById(os.laboratory);
  if (!lab) return;

  const codes = (os.stations || []).map(s => s.code);
  let changed = false;
  for (const st of lab.stations) {
    if (codes.includes(st.code) && st.status !== 'defeito') {
      st.status = 'manutencao';
      changed = true;
    }
  }
  if (changed) stationService.recomputeComputerStatus(lab);

  lab.history.push({
    user: user?._id,
    action: 'os_aberta',
    note: `OS ${os.number} (${labServiceLabel(os.serviceType)}) aberta` +
      (codes.length ? ` — estações: ${codes.join(', ')}` : ''),
  });
  await lab.save();
}

/**
 * Ao CONCLUIR (finalizar) uma OS de laboratório:
 *  - Processa as substituições (atualiza vínculo da estação + movimentação).
 *  - Define o status das estações afetadas:
 *      corretiva → 'funcionando' (problema resolvido)
 *      preventiva → mantém 'funcionando' (registra manutenção)
 *  - Atualiza datas de manutenção/movimentação das estações.
 *  - Registra no histórico do laboratório.
 */
async function onOrderCompleted(os, user) {
  if (!os.laboratory || !LAB_SERVICE_TYPES.includes(os.serviceType)) return;
  const lab = await Laboratory.findById(os.laboratory);
  if (!lab) return;

  const now = new Date();
  const codes = (os.stations || []).map(s => s.code);

  // 1) Aplica status às estações afetadas (ao concluir, considera resolvido)
  for (const st of lab.stations) {
    if (!codes.includes(st.code)) continue;
    st.status = 'funcionando';
    st.lastMaintenanceAt = now;
  }

  // 2) Recalcula contadores + datas do laboratório
  stationService.recomputeComputerStatus(lab);
  lab.lastInspectionAt = now;

  // 3) Próxima preventiva: se foi preventiva, agenda +6 meses (heurística)
  if (os.serviceType === 'manutencao_preventiva') {
    const next = new Date(now);
    next.setMonth(next.getMonth() + 6);
    lab.nextPreventiveAt = next;
  }

  lab.history.push({
    user: user?._id,
    action: 'os_concluida',
    note: `OS ${os.number} (${labServiceLabel(os.serviceType)}) concluída` +
      (codes.length ? ` — estações: ${codes.join(', ')}` : ''),
  });

  await lab.save();
}

function labServiceLabel(t) {
  return t === 'manutencao_preventiva' ? 'Manutenção Preventiva'
    : t === 'manutencao_corretiva' ? 'Manutenção Corretiva' : t;
}

module.exports = {
  LAB_SERVICE_TYPES,
  isLabOrder,
  normalizeLabFields,
  onOrderOpened,
  onOrderCompleted,
  labServiceLabel,
};
