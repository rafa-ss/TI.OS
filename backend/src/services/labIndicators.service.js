/**
 * Indicadores de gestão dos laboratórios (usado no módulo de Laboratórios e
 * no painel NOC do Dashboard). Extraído para um serviço próprio para evitar
 * dependência circular entre os controllers.
 */
const Laboratory = require('../models/Laboratory');
const ServiceOrder = require('../models/ServiceOrder');

/**
 * Calcula a agenda de manutenção preventiva ANUAL de um laboratório,
 * baseada no ANIVERSÁRIO da data de montagem.
 *
 * @returns {{ nextDue: Date|null, due: boolean, overdue: boolean, daysTo: number|null }}
 */
function computePreventiveSchedule(baseDate, lastInspectionAt, hoje = new Date()) {
  if (!baseDate) return { nextDue: null, due: false, overdue: false, daysTo: null };
  const base = new Date(baseDate);

  // A 1ª preventiva vence no PRIMEIRO aniversário da montagem (montagem + 1 ano).
  const primeiroAniv = new Date(base.getFullYear() + 1, base.getMonth(), base.getDate());

  if (hoje < primeiroAniv) {
    const daysTo = Math.round((primeiroAniv - hoje) / (1000 * 60 * 60 * 24));
    return { nextDue: primeiroAniv, due: false, overdue: false, daysTo };
  }

  const anivEsteAno = new Date(hoje.getFullYear(), base.getMonth(), base.getDate());
  let cicloAtual = anivEsteAno <= hoje
    ? anivEsteAno
    : new Date(hoje.getFullYear() - 1, base.getMonth(), base.getDate());
  if (cicloAtual < primeiroAniv) cicloAtual = primeiroAniv;

  const proximoAniv = new Date(cicloAtual.getFullYear() + 1, base.getMonth(), base.getDate());
  const feitaNoCiclo = lastInspectionAt && new Date(lastInspectionAt) >= cicloAtual;

  const nextDue = feitaNoCiclo ? proximoAniv : cicloAtual;
  const due = !feitaNoCiclo;
  const overdue = due && cicloAtual < hoje;
  const daysTo = Math.round((nextDue - hoje) / (1000 * 60 * 60 * 24));

  return { nextDue, due, overdue, daysTo };
}

/**
 * Calcula os indicadores dos laboratórios:
 *  - ativos: kind=laboratorio e status != desativado
 *  - comDefeito: pelo menos 1 estação com defeito
 *  - semVistoria: nunca vistoriado OU vistoria > 90 dias
 *  - manutencaoPendente: OS de lab aberta/em andamento OU estação em manutenção
 *  - preventivaDevida: preventiva anual (aniversário da montagem) vencida
 */
async function computeLabIndicators() {
  const STALE_DAYS = 90;
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - STALE_DAYS);

  const labs = await Laboratory.find({
    kind: 'laboratorio',
    status: { $ne: 'desativado' },
  }).select('name school status computerStatus lastInspectionAt nextPreventiveAt stations assemblyDate createdAt')
    .populate('school', 'name')
    .lean();

  const labsComOsAberta = await ServiceOrder.distinct('laboratory', {
    laboratory: { $ne: null },
    serviceType: { $in: ['manutencao_preventiva', 'manutencao_corretiva'] },
    status: { $nin: ['finalizada', 'entregue', 'cancelada'] },
  });
  const osAbertaSet = new Set(labsComOsAberta.map(String));

  const hoje = new Date();
  const ativos = [];
  const comDefeito = [];
  const semVistoria = [];
  const manutencaoPendente = [];
  const preventivaDevida = [];

  for (const lab of labs) {
    ativos.push(lab);
    const cs = lab.computerStatus || {};
    const baseDate = lab.assemblyDate || lab.createdAt;
    const prev = computePreventiveSchedule(baseDate, lab.lastInspectionAt, hoje);

    const item = {
      _id: lab._id, name: lab.name,
      school: lab.school?.name || '—',
      lastInspectionAt: lab.lastInspectionAt,
      assemblyDate: baseDate,
      nextPreventiveAt: prev.nextDue,
      preventiveDue: prev.due,
      preventiveOverdue: prev.overdue,
      daysToPreventive: prev.daysTo,
      defective: cs.defective || 0,
      maintenance: cs.maintenance || 0,
    };

    if ((cs.defective || 0) > 0) comDefeito.push(item);

    const semInspecao = !lab.lastInspectionAt || new Date(lab.lastInspectionAt) < staleDate;
    if (semInspecao) semVistoria.push(item);

    const temOsAberta = osAbertaSet.has(String(lab._id));
    if (temOsAberta || (cs.maintenance || 0) > 0) {
      manutencaoPendente.push({ ...item, temOsAberta });
    }

    if (prev.due) preventivaDevida.push(item);
  }

  preventivaDevida.sort((a, b) => (a.daysToPreventive || 0) - (b.daysToPreventive || 0));

  return {
    ativos: ativos.length,
    comDefeito: comDefeito.length,
    semVistoria: semVistoria.length,
    manutencaoPendente: manutencaoPendente.length,
    preventivaDevida: preventivaDevida.length,
    lists: {
      comDefeito: comDefeito.slice(0, 50),
      semVistoria: semVistoria.slice(0, 50),
      manutencaoPendente: manutencaoPendente.slice(0, 50),
      preventivaDevida: preventivaDevida.slice(0, 50),
    },
  };
}

module.exports = { computeLabIndicators, computePreventiveSchedule };
