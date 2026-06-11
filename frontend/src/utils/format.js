export const STATUS_LABEL = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  aguardando_peca: 'Aguardando peça',
  finalizada: 'Finalizada',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
};

export const STATUS_COLOR = {
  aberta: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  em_andamento: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  aguardando_peca: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  finalizada: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  entregue: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  cancelada: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

export const PRIORITY_LABEL = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const PRIORITY_COLOR = {
  baixa: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  media: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  alta: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  urgente: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

export const EQUIPMENT_TYPE_LABEL = {
  computador: 'Computador ',
  notebook: 'Notebook',
  impressora: 'Impressora',
  roteador: 'Roteador',
  nobreak: 'Nobreak',
  tablet: 'Tablet',
  mouse: 'Mouse',
  teclado: 'Teclado',
  estabilizador: 'Estabilizador',
  monitor: 'Monitor',
  memoria_ram: 'Memória RAM',
  fonte: 'Fonte',
  outro: 'Outro',
};

/**
 * Pega o label "bonito" pra um tipo. Se o tipo for customizado (não mapeado),
 * capitaliza a primeira letra e troca _ por espaço.
 */
export function typeLabel(t) {
  if (!t) return '-';
  if (EQUIPMENT_TYPE_LABEL[t]) return EQUIPMENT_TYPE_LABEL[t];
  const s = String(t).replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const EQUIPMENT_STATUS_LABEL = {
  em_estoque: 'Em estoque',
  em_uso: 'Em uso',
  em_manutencao: 'Em manutenção',
  aguardando_peca: 'Aguardando peça',
  inativo: 'Inativo',
  descartado: 'Descartado',
};

export const EQUIPMENT_STATUS_COLOR = {
  em_estoque: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  em_uso: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  em_manutencao: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  aguardando_peca: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  inativo: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  descartado: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

export const SERVICE_TYPE_LABEL = {
  instalacao_programas: 'Instalação de Software',
  manutencao_preventiva: 'Manutenção preventiva',
  manutencao_corretiva: 'Manutenção corretiva',
  formatacao: 'Formatação',
  configuracao_rede: 'Configuração de rede',
  troca_peca: 'Troca de peça',
  instalacao_equipamento: 'Instalação de equipamento',
  suporte_remoto: 'Suporte remoto',
  visita_tecnica: 'Visita técnica',
  outro: 'Outro',
};


export const SERVICE_LOCATION_LABEL = {
  ctec: 'SEMEC-CTEC',
  externa: 'Visita externa',
};

// Itens dos checklists de manutenção de laboratório
export const PREVENTIVE_ITEM_LABEL = {
  limpeza_fisica: 'Limpeza física',
  organizacao_cabos: 'Organização de cabos',
  atualizacao_software: 'Atualização de software',
  verificacao_antivirus: 'Verificação de antivírus',
  verificacao_rede: 'Verificação de rede',
  verificacao_eletrica: 'Verificação elétrica',
  verificacao_perifericos: 'Verificação dos periféricos',
};
export const CORRECTIVE_ITEM_LABEL = {
  equipamento_defeito: 'Equipamento com defeito',
  troca_pecas: 'Troca de peças',
  substituicao_equipamento: 'Substituição de equipamentos',
  formatacao: 'Formatação',
  reinstalacao_sistema: 'Reinstalação de sistema',
  correcao_rede: 'Correção de rede',
};

export const SERVICE_LOCATION_COLOR = {
  ctec: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  externa: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

export const ROLE_LABEL = {
  admin: 'Administrador',
  tecnico: 'Técnico',
  atendente: 'Atendente',
};

export function formatDate(d) {
  if (!d) return '-';
  try { return new Date(d).toLocaleString('pt-BR'); } catch { return '-'; }
}

export function formatDateOnly(d) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return '-'; }
}
