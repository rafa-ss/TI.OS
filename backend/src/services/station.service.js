/**
 * Serviço de ESTAÇÕES de trabalho (PC01, PC02, ...) dos laboratórios.
 *
 * As estações são geradas automaticamente conforme a quantidade de
 * "computador" no inventário do laboratório:
 *  - Se o lab tem N computadores, deve ter N estações PC01..PCnn.
 *  - Ao aumentar a qtd de computadores, criam-se novas estações no fim.
 *  - Ao diminuir, removem-se as últimas (preservando as primeiras e seus
 *    vínculos/manutenções já registrados).
 */

/** Conta quantos computadores há no inventário do lab. */
function countComputers(lab) {
  return (lab.equipments || [])
    .filter((e) => String(e.type).toLowerCase().trim() === 'computador')
    .reduce((a, e) => a + (e.quantity || 0), 0);
}

/** Formata o código da estação: 1 -> "PC01", 12 -> "PC12", 105 -> "PC105". */
function stationCode(index) {
  return `PC${String(index).padStart(2, '0')}`;
}

/**
 * Sincroniza o array `lab.stations` com a quantidade de computadores.
 * Idempotente. NÃO salva — apenas muta o documento (chame lab.save() depois).
 * Retorna { created, removed, total }.
 */
function syncStations(lab) {
  const target = countComputers(lab);
  const current = lab.stations || [];
  let created = 0;
  let removed = 0;

  if (current.length < target) {
    for (let i = current.length + 1; i <= target; i++) {
      current.push({
        code: stationCode(i),
        index: i,
        status: 'funcionando', // assume funcionando até uma vistoria dizer o contrário
      });
      created++;
    }
  } else if (current.length > target) {
    removed = current.length - target;
    current.splice(target); // remove as últimas
  }

  // Garante numeração/código consistentes (caso algo tenha ficado fora de ordem)
  current.forEach((st, i) => {
    st.index = i + 1;
    st.code = stationCode(i + 1);
  });

  lab.stations = current;
  return { created, removed, total: current.length };
}

/**
 * Recalcula os contadores `computerStatus` (active/maintenance/defective)
 * a partir do status individual das estações. Mantém o card e os indicadores
 * sempre coerentes com o mapa. NÃO salva.
 */
function recomputeComputerStatus(lab) {
  const counts = { active: 0, maintenance: 0, defective: 0 };
  for (const st of lab.stations || []) {
    if (st.status === 'funcionando') counts.active++;
    else if (st.status === 'manutencao') counts.maintenance++;
    else if (st.status === 'defeito') counts.defective++;
    // 'sem_equipamento' não conta em nenhum
  }
  lab.computerStatus = counts;
  return counts;
}

module.exports = {
  countComputers,
  stationCode,
  syncStations,
  recomputeComputerStatus,
};
