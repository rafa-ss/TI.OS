import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Pencil, Trash2, FlaskConical, Package,
  CheckCircle2, Hammer, Calendar, ArrowLeftCircle, Monitor, Laptop, Printer,
  Wifi, Battery, Tablet, HelpCircle, AlertTriangle, Mouse, Keyboard, Cpu, Cable, Zap, MemoryStick, Hash,
  Building2, Briefcase, Boxes, Minus, Wrench
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { TableSkeleton } from '../components/Loading';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import SchoolCombobox from '../components/SchoolCombobox';
import { typeLabel, formatDate } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const STATUS_LABEL = {
  planejado: 'Planejado',
  em_montagem: 'Em montagem',
  concluido: 'Concluído',
  manutencao: 'Em manutenção',
  desativado: 'Desativado',
};

const STATUS_COLOR = {
  planejado: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  em_montagem: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  concluido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  manutencao: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  desativado: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

const KIND_LABEL = {
  laboratorio: 'Laboratório de Informática',
  administrativo: 'Setor Administrativo',
};
const KIND_SHORT = {
  laboratorio: 'Laboratório',
  administrativo: 'Administrativo',
};
const KIND_COLOR = {
  laboratorio: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  administrativo: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
};
const KIND_ICON = {
  laboratorio: Monitor,
  administrativo: Briefcase,
};

// Tipos sugeridos por padrão (caso a API /stock/types ainda não tenha respondido)
const SUGGESTED_TYPES = [
  'computador','notebook','impressora','roteador','nobreak','tablet',
  'mouse','teclado','estabilizador','caixa_cabo_rj45','monitor','memoria_ram','fonte','outro'
];
const CONDITIONS = [
  { v: 'novo', l: 'Novo' },
  { v: 'usado', l: 'Usado' },
  { v: 'recondicionado', l: 'Recondicionado' },
];
const TYPE_ICONS = {
  computador: Monitor, notebook: Laptop, impressora: Printer, roteador: Wifi,
  nobreak: Battery, tablet: Tablet, mouse: Mouse, teclado: Keyboard,
  estabilizador: Zap, caixa_cabo_rj45: Cable, monitor: Monitor,
  memoria_ram: MemoryStick, fonte: Cpu, outro: HelpCircle,
};

// Cores do indicador de status de cada computador no mini-mapa.
const COMPUTER_DOT = {
  active:      'bg-emerald-500',                 // Funcionando
  maintenance: 'bg-amber-500',                   // Em manutenção
  defective:   'bg-rose-500',                    // Defeito
  empty:       'bg-slate-300 dark:bg-slate-700', // Vazio
};

/**
 * Calcula o breakdown de status dos computadores de um laboratório.
 * Total = nº de equipamentos do tipo "computador" no inventário.
 * ativos = preenchido pelo lab; se nenhum status foi informado ainda,
 * assume tudo "ativo" por padrão (lab recém-criado).
 * Retorna também um array `cells` para desenhar o mini-mapa.
 */
export function computeComputerStatus(lab) {
  const total = (lab.equipments || [])
    .filter(e => String(e.type).toLowerCase().trim() === 'computador')
    .reduce((a, e) => a + (e.quantity || 0), 0);

  const cs = lab.computerStatus || {};
  let maintenance = Math.max(0, Number(cs.maintenance) || 0);
  let defective = Math.max(0, Number(cs.defective) || 0);
  let active = Math.max(0, Number(cs.active) || 0);

  const informed = active + maintenance + defective;
  // Se nunca foi feita vistoria (nada informado) e há PCs, assume todos ativos.
  if (informed === 0 && total > 0) active = total;

  // Garante coerência: não passar do total
  const used = Math.min(active + maintenance + defective, total);
  const empty = Math.max(0, total - used);

  const cells = [
    ...Array(Math.min(active, total)).fill('active'),
    ...Array(maintenance).fill('maintenance'),
    ...Array(defective).fill('defective'),
    ...Array(empty).fill('empty'),
  ].slice(0, total);

  return { total, active, maintenance, defective, empty, cells };
}

export default function Laboratories() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const isAdmin = hasRole('admin');
  const canInspect = hasRole('admin', 'tecnico');

  const [labItems, setLabItems] = useState([]);        // Laboratórios de informática
  const [adminItems, setAdminItems] = useState([]);    // Setores administrativos
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', status: '' });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [summary, setSummary] = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  // Lab selecionado pra mostrar detalhes (tipo "Termo de Entrega")
  const [detailing, setDetailing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const [labs, admins, sum] = await Promise.all([
        api.get('/laboratories', { params: { ...base, kind: 'laboratorio', limit: 200 } }),
        api.get('/laboratories', { params: { ...base, kind: 'administrativo', limit: 200 } }),
        api.get('/laboratories/summary'),
      ]);
      setLabItems(labs.data.items);
      setAdminItems(admins.data.items);
      setSummary(sum.data.data);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  /**
   * Abre o termo de entrega (PDF) numa nova aba já pronto pra impressão.
   * Usa o blob da API + Authorization, então não vaza token na URL.
   */
  async function printTerm(lab) {
    const loadingId = toast.loading('Gerando termo para impressão...');
    try {
      const token = localStorage.getItem('os_token');
      const res = await fetch(
        `${api.defaults.baseURL}/laboratories/${lab._id}/term/pdf`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Falha ao gerar termo');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        toast.dismiss(loadingId);
        toast.error('Permita janelas pop-up neste site para imprimir.');
        return;
      }
      // Quando o PDF carregar na nova aba, dispara o diálogo de impressão.
      win.addEventListener('load', () => {
        try { setTimeout(() => win.print(), 300); } catch {}
      });
      toast.dismiss(loadingId);
      toast.success('Termo aberto em nova aba');
      // Limpa o blob URL depois de 5 min
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    } catch (err) {
      toast.dismiss(loadingId);
      toast.error(err.message || 'Erro ao gerar termo');
    }
  }

  async function downloadLabReport() {
    const loadingId = toast.loading('Gerando relatório...');
    try {
      const token = localStorage.getItem('os_token');
      const params = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v !== '')
      ).toString();
      const res = await fetch(
        `${api.defaults.baseURL}/reports/laboratories/excel${params ? '?' + params : ''}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Falha ao gerar relatório');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laboratorios-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.dismiss(loadingId);
      toast.success('Relatório baixado');
    } catch (err) {
      toast.dismiss(loadingId);
      toast.error(err.message || 'Erro ao gerar relatório');
    }
  }

  async function remove(lab) {
    if (!confirm(`Excluir o laboratório "${lab.name}"?\n\nOs equipamentos serão devolvidos ao estoque.`)) return;
    try {
      await api.delete(`/laboratories/${lab._id}`);
      toast.success('Laboratório removido e equipamentos devolvidos');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro');
    }
  }

  function countByStatus(s) {
    return summary?.byStatus.find(x => x._id === s)?.count || 0;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Monitor className="text-brand-600" size={26}/>
            Laboratórios e Setores Administrativos
          </h1>
          <p className="text-sm text-slate-500">
            Cada novo cadastro debita automaticamente os equipamentos do estoque.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadLabReport} className="btn-secondary">
            <Package size={16}/> Relatório (Excel)
          </button>
          <button onClick={() => { setEditing(null); setOpen(true); }} className="btn-primary">
            <Plus size={16}/> Novo Laboratório/Administrativo
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total" value={summary.total} color="brand" icon={Monitor}
            onClick={() => setFilters({ q: '', status: '' })}/>
          <StatCard label="Concluídos" value={summary.concluidos} color="emerald" icon={CheckCircle2}
            onClick={() => setFilters(f => ({ ...f, status: 'concluido', page: 1 }))}/>
          <StatCard label="Em montagem" value={countByStatus('em_montagem')} color="amber" icon={Hammer}
            onClick={() => setFilters(f => ({ ...f, status: 'em_montagem', page: 1 }))}/>
          <StatCard label="Equipamentos em uso" value={summary.totalEquipamentosEmUso} color="indigo" icon={Package}/>
        </div>
      )}

      {/* Filtros */}
      <div className="card p-4 grid md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400"/>
          <input className="input pl-9" placeholder="Buscar por nome, escola ou INEP..."
            value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}/>
        </div>
        <select className="input" value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* === DOIS CONTAINERS: 70% mapa de laboratórios | 30% lista de administrativos === */}
      {loading ? (
        <TableSkeleton cols={4}/>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 items-start">
          {/* --- 70%: Laboratórios de Informática (MAPA VISUAL) --- */}
          <section className="lg:col-span-7 card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Monitor size={18} className="text-indigo-600"/>
                Laboratórios de Informática
                <span className="text-xs font-normal text-slate-400">({labItems.length})</span>
              </h2>
            </div>

            {labItems.length === 0 ? (
              <EmptyState title="Nenhum laboratório"
                description="Cadastre um Laboratório de Informática para vê-lo no mapa."/>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {labItems.map(lab => (
                  <LabMapCard key={lab._id} lab={lab}
                    isAdmin={isAdmin}
                    onOpen={() => navigate(`/laboratorios/${lab._id}`)}
                    onRemove={() => remove(lab)}/>
                ))}
              </div>
            )}
          </section>

          {/* --- 30%: Setores Administrativos (LISTA COMPACTA) --- */}
          <section className="lg:col-span-3 card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Briefcase size={18} className="text-sky-600"/>
                Administrativos
                <span className="text-xs font-normal text-slate-400">({adminItems.length})</span>
              </h2>
            </div>

            {adminItems.length === 0 ? (
              <EmptyState title="Nenhum setor"
                description="Cadastre um Setor Administrativo."/>
            ) : (
              <div className="space-y-2">
                {adminItems.map(lab => (
                  <AdminListItem key={lab._id} lab={lab}
                    isAdmin={isAdmin}
                    onOpen={() => setDetailing(lab)}
                    onRemove={() => remove(lab)}/>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <LabForm open={open} onClose={() => setOpen(false)} lab={editing} isAdmin={isAdmin}
        onSaved={() => { setOpen(false); load(); }}/>
      <DeactivateModal lab={deactivating} onClose={() => setDeactivating(null)}
        onDone={() => { setDeactivating(null); load(); }}/>
      <LabDetailModal
        lab={detailing}
        onClose={() => setDetailing(null)}
        isAdmin={isAdmin}
        canInspect={canInspect}
        onPrint={printTerm}
        onEdit={(lab) => { setDetailing(null); setEditing(lab); setOpen(true); }}
        onDeactivate={(lab) => { setDetailing(null); setDeactivating(lab); }}
        onInspected={async () => {
          // Recarrega a lista e atualiza o lab aberto no modal com os dados novos
          try {
            const { data } = await api.get(`/laboratories/${detailing._id}`);
            setDetailing(data.laboratory);
          } catch {}
          load();
        }}
      />
    </div>
  );
}

// =============================================================
// Card visual do "mapa" de Laboratórios (container 70%)
// =============================================================
function LabMapCard({ lab, isAdmin, onOpen, onRemove }) {
  const { total, active, maintenance, defective, cells } = computeComputerStatus(lab);

  // Define o nº de colunas do mini-mapa conforme a quantidade (mantém quadradinho)
  const cols = total <= 4 ? 4 : total <= 9 ? 5 : total <= 16 ? 6 : total <= 25 ? 7 : 8;

  return (
    <div onClick={onOpen}
      className="group relative flex flex-col text-left rounded-2xl border border-slate-200 dark:border-slate-700
                 bg-white dark:bg-slate-900 shadow-sm hover:shadow-xl hover:-translate-y-1
                 transition-all duration-200 cursor-pointer overflow-hidden">
      {/* Cabeçalho: nome + escola */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Monitor size={16} className="text-indigo-600 shrink-0"/>
              <h3 className="font-bold text-slate-900 dark:text-white truncate">{lab.name}</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5" title={lab.school?.name || ''}>
              {lab.school?.name || '—'}
            </p>
          </div>
          {lab.deliveryTermNumber && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 shrink-0">
              <Hash size={9}/>{lab.deliveryTermNumber}
            </span>
          )}
        </div>
      </div>

      {/* Mini-mapa visual dos computadores */}
      <div className="px-4">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
          {total === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-3">Nenhum computador cadastrado</p>
          ) : (
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {cells.map((s, i) => (
                <div key={i}
                  title={
                    s === 'active' ? 'Funcionando'
                    : s === 'maintenance' ? 'Em manutenção'
                    : s === 'defective' ? 'Defeito' : 'Vazio'
                  }
                  className={`aspect-square rounded-md ${COMPUTER_DOT[s]} ${
                    s === 'empty' ? '' : 'shadow-sm'
                  } transition-transform group-hover:scale-[1.03]`}/>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-4 gap-1 px-4 py-3 text-center">
        <Counter label="Total" value={total} className="text-slate-700 dark:text-slate-200"/>
        <Counter label="Ativos" value={active} dot="bg-emerald-500" className="text-emerald-600"/>
        <Counter label="Manut." value={maintenance} dot="bg-amber-500" className="text-amber-600"/>
        <Counter label="Defeito" value={defective} dot="bg-rose-500" className="text-rose-600"/>
      </div>

      {/* Rodapé: última vistoria */}
      <div className="mt-auto px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <Calendar size={12}/>
          {lab.lastInspectionAt
            ? `Vistoria: ${formatDate(lab.lastInspectionAt).split(' ')[0]}`
            : 'Sem vistoria'}
        </span>
        <span className={`badge ${STATUS_COLOR[lab.status || 'planejado']}`}>
          {STATUS_LABEL[lab.status || 'planejado']}
        </span>
      </div>

      {isAdmin && (
        <span
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity btn-ghost p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded"
          title="Excluir">
          <Trash2 size={14}/>
        </span>
      )}
    </div>
  );
}

// Mini componente de contador usado no rodapé do card
function Counter({ label, value, dot, className = '' }) {
  return (
    <div>
      <div className={`flex items-center justify-center gap-1 text-lg font-bold ${className}`}>
        {dot && <span className={`w-2 h-2 rounded-full ${dot}`}/>}
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

// =============================================================
// Item de lista compacta de Setores Administrativos (container 30%)
// =============================================================
function AdminListItem({ lab, isAdmin, onOpen, onRemove }) {
  const status = lab.status || 'planejado';
  const dot = {
    planejado: 'bg-slate-400',
    em_montagem: 'bg-amber-500',
    concluido: 'bg-emerald-500',
    manutencao: 'bg-violet-500',
    desativado: 'bg-rose-500',
  }[status] || 'bg-slate-400';

  return (
    <div onClick={onOpen}
      className="group flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-colors">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} title={STATUS_LABEL[status]}/>
      <Briefcase size={14} className="text-sky-600 shrink-0"/>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{lab.name}</p>
        <p className="text-[10px] text-slate-500 truncate" title={lab.school?.name || ''}>{lab.school?.name || '—'}</p>
      </div>
      {lab.deliveryTermNumber && (
        <span className="text-[9px] font-mono text-slate-400 shrink-0">{lab.deliveryTermNumber}</span>
      )}
      {isAdmin && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity btn-ghost p-1 text-rose-500 shrink-0"
          title="Excluir">
          <Trash2 size={13}/>
        </button>
      )}
    </div>
  );
}

// =============================================================
// Modal de Detalhes do Laboratório/Setor — visualização completa
// (estilo "termo": tudo bonito, organizado em seções, com ações no rodapé)
// =============================================================
function LabDetailModal({ lab, onClose, isAdmin, canInspect, onPrint, onEdit, onDeactivate, onInspected }) {
  const [showInspect, setShowInspect] = useState(false);
  // Reseta o painel de vistoria sempre que troca de laboratório
  useEffect(() => { setShowInspect(false); }, [lab?._id]);

  if (!lab) return null;
  const kind = lab.kind || 'laboratorio';
  const KindIcon = KIND_ICON[kind] || Monitor;
  const totalEq = (lab.equipments || []).reduce((a, e) => a + e.quantity, 0);
  const active = !lab.returnedToStock && lab.status !== 'desativado';
  const isLab = kind === 'laboratorio';
  const cstat = computeComputerStatus(lab);

  // Cabeçalho colorido do modal
  const headerColor = kind === 'administrativo' ? 'from-sky-500 to-sky-600' : 'from-indigo-500 to-indigo-600';

  return (
    <Modal open={!!lab} onClose={onClose} size="lg"
      title={
        <div className="flex items-center gap-2">
          <KindIcon size={22}/>
          <span>Detalhes — {lab.name}</span>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onPrint(lab)}
              className="btn-primary !bg-indigo-600 hover:!bg-indigo-700">
              <Printer size={16}/> Imprimir Termo
            </button>
            {isLab && canInspect && active && (
              <button onClick={() => setShowInspect(v => !v)}
                className="btn-secondary !text-emerald-700 !border-emerald-300 hover:!bg-emerald-50 dark:!text-emerald-300 dark:!border-emerald-800 dark:hover:!bg-emerald-900/30">
                <Wrench size={16}/> {showInspect ? 'Fechar manutenção' : 'Registrar Manutenção'}
              </button>
            )}
            <button onClick={() => onEdit(lab)} className="btn-secondary">
              <Pencil size={16}/> Editar
            </button>
            {active && (
              <button onClick={() => onDeactivate(lab)}
                className="btn-secondary !text-amber-700 !border-amber-300 hover:!bg-amber-50 dark:!text-amber-300 dark:!border-amber-800 dark:hover:!bg-amber-900/30">
                <ArrowLeftCircle size={16}/> Desativar
              </button>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost">Fechar</button>
        </div>
      }>
      <div className="space-y-4">
        {/* Cabeçalho com Nº do termo e tipo */}
        <div className={`rounded-xl p-4 text-white bg-gradient-to-r ${headerColor} shadow-sm`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[11px] uppercase opacity-80 font-semibold tracking-wider">{KIND_LABEL[kind]}</p>
              <p className="text-lg font-bold leading-tight">{lab.name}</p>
              <p className="text-xs opacity-90 mt-0.5">{lab.school?.name || '—'}{lab.school?.inep ? ` · INEP ${lab.school.inep}` : ''}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase opacity-80 font-semibold tracking-wider">Nº do Termo</p>
              {lab.deliveryTermNumber ? (
                <p className="text-2xl font-mono font-bold tracking-wide">{lab.deliveryTermNumber}</p>
              ) : (
                <p className="text-xs italic opacity-80">não emitido</p>
              )}
            </div>
          </div>
        </div>

        {/* Mini-mapa dos computadores + status (somente laboratórios) */}
        {isLab && (
          <section className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Monitor size={14}/> Mapa dos computadores
              </h4>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Calendar size={12}/>
                {lab.lastInspectionAt
                  ? `Última vistoria: ${formatDate(lab.lastInspectionAt)}`
                  : 'Sem vistoria registrada'}
              </span>
            </div>

            {cstat.total === 0 ? (
              <p className="text-sm text-slate-400 italic">Nenhum computador cadastrado neste laboratório.</p>
            ) : (
              <>
                <div className="grid gap-1.5 mb-3"
                  style={{ gridTemplateColumns: `repeat(${cstat.total <= 16 ? 8 : 10}, minmax(0, 1fr))` }}>
                  {cstat.cells.map((s, i) => (
                    <div key={i}
                      title={s === 'active' ? 'Funcionando' : s === 'maintenance' ? 'Em manutenção' : s === 'defective' ? 'Defeito' : 'Vazio'}
                      className={`aspect-square rounded-md ${COMPUTER_DOT[s]} ${s === 'empty' ? '' : 'shadow-sm'}`}/>
                  ))}
                </div>
                {/* Legenda */}
                <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                  <Legend dot="bg-emerald-500" label={`Funcionando (${cstat.active})`}/>
                  <Legend dot="bg-amber-500" label={`Manutenção (${cstat.maintenance})`}/>
                  <Legend dot="bg-rose-500" label={`Defeito (${cstat.defective})`}/>
                  <Legend dot="bg-slate-300 dark:bg-slate-700" label={`Vazio (${cstat.empty})`}/>
                </div>
              </>
            )}

            {/* Painel de registro de manutenção/vistoria */}
            {showInspect && (
              <InspectPanel lab={lab} cstat={cstat}
                onClose={() => setShowInspect(false)}
                onSaved={() => { setShowInspect(false); onInspected?.(); }}/>
            )}
          </section>
        )}

        {/* Grade de informações principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <DetailField label="Status">
            <span className={`badge ${STATUS_COLOR[lab.status]}`}>{STATUS_LABEL[lab.status]}</span>
          </DetailField>
          <DetailField label="Tipo de espaço">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${KIND_COLOR[kind]}`}>
              <KindIcon size={11}/>{KIND_SHORT[kind]}
            </span>
          </DetailField>
          <DetailField label="Data de montagem">
            <span className="text-sm font-medium">
              {lab.assemblyDate ? formatDate(lab.assemblyDate).split(' ')[0] : '—'}
            </span>
          </DetailField>
          <DetailField label="Data de conclusão">
            <span className="text-sm font-medium">
              {lab.completionDate ? formatDate(lab.completionDate).split(' ')[0] : '—'}
            </span>
          </DetailField>
        </div>

        {/* Responsáveis */}
        <section className="card p-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
            👥 Responsáveis pela montagem
          </h4>
          {(lab.responsibles && lab.responsibles.length > 0) ? (
            <div className="flex flex-wrap gap-1">
              {lab.responsibles.map(r => {
                const cls = r.role === 'admin'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                  : r.role === 'atendente'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
                const icon = r.role === 'admin' ? '👤' : r.role === 'atendente' ? '☎️' : '🔧';
                const roleStr = r.role === 'admin' ? 'Admin' : r.role === 'atendente' ? 'Atendente' : 'Técnico';
                return (
                  <span key={r._id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${cls}`}>
                    {icon} {r.name} <span className="opacity-60">({roleStr})</span>
                  </span>
                );
              })}
            </div>
          ) : lab.responsibleTech?.name ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              🔧 {lab.responsibleTech.name}
            </span>
          ) : (
            <span className="text-xs text-slate-400 italic">Nenhum responsável atribuído</span>
          )}
        </section>

        {/* Kits utilizados */}
        {Array.isArray(lab.kits) && lab.kits.length > 0 && (
          <section className="card p-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
              <Boxes size={14}/> Kits montados
            </h4>
            <div className="grid sm:grid-cols-2 gap-2">
              {lab.kits.map((k, i) => (
                <div key={i} className="p-2 rounded-md bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 text-sm">
                  <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                    <Boxes size={14} className="text-brand-600"/> {k.quantity}× {k.name}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {(k.components || []).map(c => `${c.quantity}× ${typeLabel(c.type)}`).join(' + ')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Equipamentos (inventário real — componentes individuais) */}
        <section className="card p-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between gap-1">
            <span className="flex items-center gap-1"><Package size={14}/> Equipamentos (detalhado)</span>
            {totalEq > 0 && <span className="text-[10px] text-slate-500 font-medium normal-case">{totalEq} unid. no total</span>}
          </h4>
          {(!lab.equipments || lab.equipments.length === 0) ? (
            <p className="text-xs text-slate-400 italic">Nenhum equipamento atribuído</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {lab.equipments.map((eq, i) => {
                const Icon = TYPE_ICONS[eq.type] || HelpCircle;
                return (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-slate-50 dark:bg-slate-800/40 text-sm">
                    <Icon size={16} className="text-brand-600 shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{typeLabel(eq.type)}</p>
                      <p className="text-[10px] text-slate-500 capitalize">{eq.condition}</p>
                    </div>
                    <span className="text-base font-bold text-brand-600">{eq.quantity}×</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Observações */}
        {lab.notes && (
          <section className="card p-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">📝 Observações</h4>
            <p className="text-sm whitespace-pre-line">{lab.notes}</p>
          </section>
        )}

        {/* Histórico */}
        {lab.history && lab.history.length > 0 && (
          <section className="card p-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
              🕒 Histórico ({lab.history.length})
            </h4>
            <div className="max-h-[200px] overflow-y-auto space-y-1.5 pr-1">
              {[...lab.history].reverse().map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-xs p-2 rounded bg-slate-50 dark:bg-slate-800/40">
                  <span className="text-slate-400 font-mono shrink-0">{formatDate(h.date)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 dark:text-slate-200">{h.action || '—'}</p>
                    {h.note && <p className="text-slate-500 dark:text-slate-400">{h.note}</p>}
                    {h.user?.name && <p className="text-[10px] text-slate-400">por {h.user.name}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Rodapé com dados de criação */}
        <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
          {lab.createdBy?.name && <span>Criado por: <b>{lab.createdBy.name}</b></span>}
          {lab.createdAt && <span>Em: {formatDate(lab.createdAt)}</span>}
          {lab.updatedAt && lab.updatedAt !== lab.createdAt && <span>Última atualização: {formatDate(lab.updatedAt)}</span>}
        </div>
      </div>
    </Modal>
  );
}

// Legenda colorida do mini-mapa
function Legend({ dot, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-2.5 h-2.5 rounded ${dot}`}/> {label}
    </span>
  );
}

// =============================================================
// Painel de registro de Manutenção / Vistoria (dentro do modal de detalhes)
// =============================================================
function InspectPanel({ lab, cstat, onClose, onSaved }) {
  const [active, setActive] = useState(cstat.active);
  const [maintenance, setMaintenance] = useState(cstat.maintenance);
  const [defective, setDefective] = useState(cstat.defective);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const total = cstat.total;
  const soma = (Number(active) || 0) + (Number(maintenance) || 0) + (Number(defective) || 0);
  const empty = Math.max(0, total - soma);
  const invalid = soma > total;

  async function save() {
    if (invalid) return toast.error(`A soma (${soma}) não pode passar do total de computadores (${total}).`);
    setSaving(true);
    try {
      await api.post(`/laboratories/${lab._id}/inspect`, {
        active: Number(active) || 0,
        maintenance: Number(maintenance) || 0,
        defective: Number(defective) || 0,
        note,
      });
      toast.success('Manutenção/vistoria registrada');
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao registrar vistoria');
    } finally { setSaving(false); }
  }

  const numInput = (val, setter, accent) => (
    <input type="number" min="0" max={total} value={val}
      onChange={e => setter(Math.max(0, Number(e.target.value) || 0))}
      className={`input !py-1.5 text-center font-bold ${accent}`}/>
  );

  return (
    <div className="mt-4 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10">
      <div className="flex items-center justify-between mb-2">
        <h5 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1">
          <Wrench size={15} className="text-emerald-600"/> Registrar manutenção / vistoria
        </h5>
        <span className="text-[11px] text-slate-500">Total de computadores: <b>{total}</b></span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] uppercase font-semibold text-emerald-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"/> Funcionando
          </label>
          {numInput(active, setActive, 'border-emerald-300 dark:border-emerald-800')}
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-amber-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"/> Manutenção
          </label>
          {numInput(maintenance, setMaintenance, 'border-amber-300 dark:border-amber-800')}
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-rose-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"/> Defeito
          </label>
          {numInput(defective, setDefective, 'border-rose-300 dark:border-rose-800')}
        </div>
      </div>

      <div className="mt-2 text-[11px] flex items-center justify-between">
        <span className={invalid ? 'text-rose-600 font-semibold' : 'text-slate-500'}>
          {invalid
            ? `⚠️ Soma (${soma}) maior que o total (${total})`
            : `Vazios/disponíveis: ${empty}`}
        </span>
      </div>

      <div className="mt-2">
        <label className="text-[10px] uppercase font-semibold text-slate-500">Observação (opcional)</label>
        <input className="input !py-1.5" placeholder="Ex.: PC 3 com fonte queimada, aguardando peça"
          value={note} onChange={e => setNote(e.target.value)}/>
      </div>

      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onClose} className="btn-ghost text-sm">Cancelar</button>
        <button onClick={save} disabled={saving || invalid}
          className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 text-sm">
          {saving ? 'Salvando...' : 'Salvar vistoria'}
        </button>
      </div>
    </div>
  );
}

// Campo "etiqueta + valor" usado no modal de detalhes
function DetailField({ label, children }) {
  return (
    <div className="card p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon, onClick }) {
  const content = (
    <>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-${color}-100 text-${color}-700 dark:bg-${color}-900/30 dark:text-${color}-300 shrink-0`}>
        <Icon size={20}/>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{value}</p>
      </div>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick}
        className="card p-4 flex items-center gap-3 text-left w-full
                   hover:border-brand-400 hover:shadow-lg hover:-translate-y-0.5
                   transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/40">
        {content}
      </button>
    );
  }
  return <div className="card p-4 flex items-center gap-3">{content}</div>;
}

// =============================================================
// Card de seleção (Laboratório / Administrativo)
// =============================================================
function KindCard({ active, icon: Icon, title, description, color = 'indigo', onClick }) {
  const colorMap = {
    indigo: {
      activeBg: 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 ring-indigo-200 dark:ring-indigo-800',
      icon: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    },
    sky: {
      activeBg: 'bg-sky-50 dark:bg-sky-900/30 border-sky-500 ring-sky-200 dark:ring-sky-800',
      icon: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    },
  };
  const c = colorMap[color] || colorMap.indigo;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3
        ${active
          ? `${c.activeBg} ring-4 shadow-md`
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/40'}`}
    >
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${c.icon}`}>
        <Icon size={22}/>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{title}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{description}</p>
      </div>
      {active && (
        <CheckCircle2 size={18} className="text-emerald-500 shrink-0"/>
      )}
    </button>
  );
}

// =============================================================
// Formulário de Cadastro / Edição
// =============================================================
function LabForm({ open, onClose, lab, onSaved, isAdmin }) {
  // Estado inicial COMPLETAMENTE limpo — sem qualquer resquício
  const empty = {
    kind: 'laboratorio',
    name: '',
    school: '',
    status: 'planejado',
    responsibles: [],
    assemblyDate: '',
    notes: '',
    deliveryTermNumber: '',
    equipments: [],
    kits: [], // [{ kit: id, quantity: N }]
  };
  const [form, setForm] = useState(empty);
  const [staff, setStaff] = useState([]);  // técnicos + admins + atendentes
  const [stockSummary, setStockSummary] = useState(null);
  const [kitsAvailable, setKitsAvailable] = useState([]); // catálogo de kits ativos
  // Tipos que TÊM estoque disponível (computado a partir do /stock/summary)
  // Default: vazio — só mostra o que realmente existe no estoque.
  const [availableTypes, setAvailableTypes] = useState([]);
  const [saving, setSaving] = useState(false);

  // SEMPRE que o modal abrir (com lab ou sem), zera o form ANTES de carregar dados.
  // Isso elimina qualquer resquício de cadastros anteriores.
  useEffect(() => {
    if (!open) { setForm(empty); return; }
    // Reseta primeiro pra evitar piscar dados do form anterior
    setForm(empty);
    setStaff([]);
    setAvailableTypes([]);
    setStockSummary(null);
    setKitsAvailable([]);

    // Catálogo de kits ativos (para seleção na montagem)
    api.get('/kits')
      .then(r => setKitsAvailable(r.data.items || []))
      .catch(() => {});

    // Carrega a equipe (técnicos + admins + atendentes ativos).
    // Usa /users/staff, acessível a admin E técnico (não exige perfil admin).
    api.get('/users/staff')
      .then(r => {
        const list = r.data.items || [];
        setStaff([...list].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => {});

    // Estoque: pega summary (já tem byType com totais)
    api.get('/stock/summary')
      .then(r => {
        const data = r.data?.data;
        setStockSummary(data);
        // Só os tipos COM ESTOQUE > 0 — bem mais intuitivo
        const tipos = (data?.byType || [])
          .filter(x => (x.total || 0) > 0)
          .map(x => x._id)
          .filter(Boolean)
          .sort();
        setAvailableTypes(tipos);
      }).catch(() => {});

    // Preenche o form com dados do lab (modo edição)
    if (lab) {
      setForm({
        ...empty,
        kind: lab.kind || 'laboratorio',
        name: lab.name || '',
        school: lab.school?._id || '',
        status: lab.status || 'planejado',
        responsibles: lab.responsibles && lab.responsibles.length > 0
          ? lab.responsibles.map(r => r._id)
          : (lab.responsibleTech?._id ? [lab.responsibleTech._id] : []),
        assemblyDate: lab.assemblyDate ? String(lab.assemblyDate).slice(0,10) : '',
        notes: lab.notes || '',
        deliveryTermNumber: lab.deliveryTermNumber || '',
        equipments: Array.isArray(lab.equipments) ? lab.equipments.map(e => ({ ...e })) : [],
        kits: Array.isArray(lab.kits)
          ? lab.kits.map(k => ({ kit: k.kit?._id || k.kit || k.slug, quantity: k.quantity }))
          : [],
      });
    }
    // eslint-disable-next-line
  }, [open, lab]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function addEquip() {
    const defaultType = availableTypes[0] || 'computador';
    set('equipments', [...form.equipments, { type: defaultType, condition: 'novo', quantity: 1 }]);
  }
  function updateEquip(i, field, value) {
    const next = [...form.equipments];
    next[i] = { ...next[i], [field]: field === 'quantity' ? Number(value) || 1 : value };
    set('equipments', next);
  }
  function removeEquip(i) {
    set('equipments', form.equipments.filter((_, idx) => idx !== i));
  }

  function getStockFor(type, condition) {
    // não temos quebra por condition no summary; vamos somar todos os tipos
    return stockSummary?.byType.find(x => x._id === type)?.total || 0;
  }

  // === KITS ===
  function setKitQty(kitId, quantity) {
    const q = Math.max(0, Number(quantity) || 0);
    const next = form.kits.filter(k => k.kit !== kitId);
    if (q > 0) next.push({ kit: kitId, quantity: q });
    set('kits', next);
  }
  function getKitQty(kitId) {
    return form.kits.find(k => k.kit === kitId)?.quantity || 0;
  }

  // Calcula a demanda total por tipo somando os componentes dos kits
  // selecionados + os itens avulsos. Usado para checar estoque do kit.
  function kitComponentDemand() {
    const demand = {}; // type -> total
    for (const sel of form.kits) {
      const kit = kitsAvailable.find(k => k._id === sel.kit);
      if (!kit) continue;
      for (const c of kit.components) {
        demand[c.type] = (demand[c.type] || 0) + (c.quantityPerKit * sel.quantity);
      }
    }
    for (const eq of form.equipments) {
      demand[eq.type] = (demand[eq.type] || 0) + (Number(eq.quantity) || 0);
    }
    return demand;
  }

  // Retorna lista de faltas: [{ type, need, have }]
  function kitStockShortages() {
    const demand = kitComponentDemand();
    const shortages = [];
    for (const [type, need] of Object.entries(demand)) {
      const have = getStockFor(type);
      if (need > have) shortages.push({ type, need, have });
    }
    return shortages;
  }

  async function submit(e) {
    e?.preventDefault();
    if (!form.name.trim()) return toast.error(form.kind === 'administrativo' ? 'Informe o nome do setor' : 'Informe o nome do laboratório');
    if (!form.school) return toast.error('Selecione a escola');

    setSaving(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach(k => payload[k] === '' && delete payload[k]);

      // O número do Termo é 100% automático (gerado no backend). Nunca enviamos.
      delete payload.deliveryTermNumber;

      if (lab) {
        // Admin pode incluir/excluir/alterar equipamentos/kits; demais perfis: backend ignora
        if (!isAdmin) {
          delete payload.equipments;
          delete payload.kits;
        }
        await api.put(`/laboratories/${lab._id}`, payload);
        toast.success(isAdmin && payload.equipments
          ? 'Laboratório atualizado (estoque ajustado conforme alterações)'
          : 'Laboratório atualizado');
      } else {
        await api.post('/laboratories', payload);
        toast.success(payload.kind === 'administrativo'
          ? 'Setor administrativo criado e equipamentos debitados do estoque'
          : 'Laboratório criado e equipamentos debitados do estoque');
      }
      onSaved?.();
    } catch (err) {
      const msg = err.response?.data?.message || 'Erro ao salvar';
      const details = err.response?.data?.details;
      if (Array.isArray(details)) {
        toast.error(msg, { duration: 6000 });
      } else {
        toast.error(msg);
      }
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg"
      title={lab
        ? `Editar — ${lab.name}`
        : `Novo cadastro — ${KIND_LABEL[form.kind] || 'Laboratório'}`}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={submit} disabled={saving} className="btn-primary">
          {saving ? 'Salvando...' : (lab ? 'Salvar alterações' : 'Criar e debitar do estoque')}
        </button>
      </>}>
      <form onSubmit={submit} className="space-y-5">
        {/* === TIPO DE ESPAÇO === */}
        <section>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Laboratório/Administrativo *</h3>
          <p className="text-xs text-slate-500 mb-3">Esta escolha aparecerá no <b>Termo de Entrega</b> impresso.</p>
          <div className="grid grid-cols-2 gap-3">
            <KindCard
              active={form.kind === 'laboratorio'}
              icon={Monitor}
              title="Laboratório de Informática"
              description="Sala equipada para uso pedagógico (alunos)"
              color="indigo"
              onClick={() => set('kind', 'laboratorio')}
            />
            <KindCard
              active={form.kind === 'administrativo'}
              icon={Briefcase}
              title="Setor Administrativo"
              description="Secretaria, direção, sala de professores etc."
              color="sky"
              onClick={() => set('kind', 'administrativo')}
            />
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Informações gerais</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">
                Nome {form.kind === 'administrativo' ? 'do setor' : 'do laboratório'} *
              </label>
              <input required className="input"
                placeholder={form.kind === 'administrativo'
                  ? 'Ex.: "Secretaria Escolar", "Sala da Direção"'
                  : 'Ex.: "Laboratório de Informática - Sala 03"'}
                value={form.name} onChange={e => set('name', e.target.value)}/>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Escola</h3>
          <SchoolCombobox value={form.school} onChange={(id) => set('school', id)}/>
        </section>

        <section>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Atribuição</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Responsáveis pela montagem</label>
              <ResponsiblesPicker
                value={form.responsibles}
                options={staff}
                onChange={(ids) => set('responsibles', ids)}
              />
              <p className="text-[11px] text-slate-500 mt-1">Selecione um ou mais membros da equipe (técnicos, administradores e/ou atendentes)</p>
            </div>
            <div>
              <label className="label">Data de montagem</label>
              <input type="date" className="input" value={form.assemblyDate}
                onChange={e => set('assemblyDate', e.target.value)}/>
            </div>
          </div>
        </section>

        {/* === TERMO DE ENTREGA — numeração 100% automática (somente leitura) === */}
        <section className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
            <Hash size={16} className="text-brand-600"/> Nº do Termo de Entrega
          </h3>
          {lab && form.deliveryTermNumber ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-xl font-bold tracking-wide px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                {form.deliveryTermNumber}
              </span>
              <p className="text-xs text-slate-500">
                🔒 Gerado automaticamente pelo sistema. Sequencial por ano (NN/AAAA) e <b>não editável</b>.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              🔢 O número será <b>gerado automaticamente</b> pelo sistema ao salvar (formato <b>NN/AAAA</b>, sequencial por ano).
              Não é necessário digitar nada.
            </p>
          )}
        </section>

        {/* === KITS === */}
        {(!lab || isAdmin) && kitsAvailable.length > 0 && (
          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
              <Boxes size={16}/> Kits
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Selecione kits prontos. Cada kit debita seus componentes do estoque automaticamente.
            </p>

            <div className="grid sm:grid-cols-2 gap-2">
              {kitsAvailable.map((kit) => {
                const KitIcon = TYPE_ICONS[kit.components?.[0]?.type] || Boxes;
                const qty = getKitQty(kit._id);
                const compo = kit.components.map(c => `${c.quantityPerKit}× ${typeLabel(c.type)}`).join(' + ');
                return (
                  <div key={kit._id}
                    className={`p-3 rounded-lg border transition-colors ${
                      qty > 0
                        ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-700'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'
                    }`}>
                    <div className="flex items-start gap-2">
                      <div className="w-9 h-9 shrink-0 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-600 grid place-items-center">
                        <KitIcon size={18}/>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{kit.name}</p>
                        <p className="text-[11px] text-slate-500 truncate" title={compo}>{compo}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-2">
                      <span className="text-[11px] text-slate-500 mr-auto">Quantidade</span>
                      <button type="button" onClick={() => setKitQty(kit._id, qty - 1)}
                        disabled={qty <= 0}
                        className="btn-ghost p-1 disabled:opacity-30">
                        <Minus size={14}/>
                      </button>
                      <input type="number" min="0" className="input !py-1 !w-16 text-center font-bold"
                        value={qty} onChange={e => setKitQty(kit._id, e.target.value)}/>
                      <button type="button" onClick={() => setKitQty(kit._id, qty + 1)}
                        className="btn-ghost p-1">
                        <Plus size={14}/>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Aviso de estoque insuficiente considerando kits + avulsos */}
            {(() => {
              const shortages = kitStockShortages();
              if (shortages.length === 0) return null;
              return (
                <div className="mt-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-3">
                  <p className="font-semibold flex items-center gap-1 mb-1">
                    <AlertTriangle size={14}/> Estoque insuficiente para os kits/itens selecionados:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {shortages.map(s => (
                      <li key={s.type}>
                        <b>{typeLabel(s.type)}</b>: precisa de {s.need}, disponível {s.have} (faltam {s.need - s.have})
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </section>
        )}

        {/* === EQUIPAMENTOS === */}
        {(!lab || isAdmin) && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Package size={16}/> {lab ? 'Equipamentos avulsos do laboratório' : 'Equipamentos avulsos (fora de kit)'}
              </h3>
              <button type="button" onClick={addEquip}
                disabled={availableTypes.length === 0 && form.equipments.length === 0}
                className="btn-secondary !py-1 !px-3 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                title={availableTypes.length === 0 ? 'Cadastre itens no estoque primeiro' : 'Adicionar equipamento'}>
                <Plus size={14}/> Adicionar
              </button>
            </div>

            {form.equipments.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-5 text-center">
                {availableTypes.length === 0 ? (
                  <>
                    <Package size={28} className="mx-auto text-slate-400 mb-1"/>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nenhum equipamento no estoque</p>
                    <p className="text-xs text-slate-500 mt-1">Cadastre lotes em <b>Estoque</b> antes de retirar equipamentos.</p>
                  </>
                ) : (
                  <>
                    <Plus size={24} className="mx-auto text-slate-400 mb-1"/>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Clique em "Adicionar" para incluir equipamentos.</p>
                    <p className="text-[11px] text-slate-500 mt-1">{availableTypes.length} tipo(s) disponível(is) no estoque: <b>{availableTypes.map(t => typeLabel(t)).join(', ')}</b></p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {form.equipments.map((eq, i) => {
                  const Icon = TYPE_ICONS[eq.type] || HelpCircle;
                  const stockQty = getStockFor(eq.type, eq.condition);
                  const insufficient = stockQty < eq.quantity;
                  return (
                    <div key={i} className={`grid grid-cols-12 gap-2 items-start p-3 rounded-lg border ${
                      insufficient
                        ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'
                    }`}>
                      <div className="col-span-4">
                        <label className="text-[10px] uppercase font-semibold text-slate-500">Tipo</label>
                        <select className="input !py-1.5" value={eq.type} onChange={e => updateEquip(i, 'type', e.target.value)}>
                          {availableTypes.length === 0 && (
                            <option value="">— estoque vazio —</option>
                          )}
                          {/* Garante que o tipo atual apareça mesmo se já foi todo retirado do estoque (modo edição) */}
                          {(eq.type && !availableTypes.includes(eq.type) ? [eq.type, ...availableTypes] : availableTypes).map(t => (
                            <option key={t} value={t}>{typeLabel(t)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] uppercase font-semibold text-slate-500">Condição</label>
                        <select className="input !py-1.5" value={eq.condition} onChange={e => updateEquip(i, 'condition', e.target.value)}>
                          {CONDITIONS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] uppercase font-semibold text-slate-500">Quantidade</label>
                        <input type="number" min="1" className="input !py-1.5 text-center font-bold"
                          value={eq.quantity} onChange={e => updateEquip(i, 'quantity', e.target.value)}/>
                      </div>
                      <div className="col-span-2 flex items-end justify-end h-full">
                        <button type="button" onClick={() => removeEquip(i)} className="btn-ghost p-1.5 text-rose-500">
                          <Trash2 size={16}/>
                        </button>
                      </div>
                      <div className="col-span-12 flex items-center gap-2 text-xs">
                        <Icon size={14} className="text-brand-600"/>
                        {insufficient ? (
                          <span className="text-rose-600 font-semibold flex items-center gap-1">
                            <AlertTriangle size={12}/>
                            Estoque insuficiente! Disponível: {stockQty} · Pedido: {eq.quantity}
                          </span>
                        ) : (
                          <span className="text-emerald-600">
                            ✓ Estoque disponível: {stockQty} unidade(s) deste tipo
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mt-3 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              💡 {lab
                ? 'Itens novos/aumentados são retirados do estoque automaticamente. Itens removidos/diminuídos voltam para o estoque (Coordenação de tecnologia educacional).'
                : 'Ao criar o laboratório, as quantidades serão retiradas automaticamente do seu estoque (lotes mais antigos primeiro).'}
            </p>
          </section>
        )}

        {lab && !isAdmin && (
          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
              <Package size={16}/> Equipamentos deste laboratório
            </h3>
            <div className="space-y-1">
              {lab.equipments.map((eq, i) => {
                const Icon = TYPE_ICONS[eq.type] || HelpCircle;
                return (
                  <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-slate-50 dark:bg-slate-800/40">
                    <Icon size={14} className="text-brand-600"/>
                    <b>{eq.quantity}×</b> {typeLabel(eq.type)} ({eq.condition})
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Para alterar a quantidade de equipamentos, desative o laboratório (devolve ao estoque) e crie um novo.
            </p>
          </section>
        )}

        <section>
          <label className="label">Observações</label>
          <textarea rows={2} className="input"
            placeholder="Ex.: Sala 03, lab montado em parceria com programa X..."
            value={form.notes} onChange={e => set('notes', e.target.value)}/>
        </section>
      </form>
    </Modal>
  );
}

// =============================================================
// Modal de Desativação
// =============================================================
function DeactivateModal({ lab, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (lab) setNote(''); }, [lab]);

  async function submit() {
    setSaving(true);
    try {
      await api.post(`/laboratories/${lab._id}/deactivate`, { note });
      toast.success('Laboratório desativado. Equipamentos devolvidos ao estoque.');
      onDone?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro');
    } finally { setSaving(false); }
  }

  if (!lab) return null;
  const total = lab.equipments.reduce((a, e) => a + e.quantity, 0);

  return (
    <Modal open={!!lab} onClose={onClose}
      title={`Desativar laboratório`}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={submit} disabled={saving} className="btn-danger">
          {saving ? 'Processando...' : 'Confirmar e devolver ao estoque'}
        </button>
      </>}>
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm">
          <p className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
            ⚠️ Você vai desativar o laboratório <b>"{lab.name}"</b>
          </p>
          <p className="text-amber-700 dark:text-amber-300">
            <b>{total} equipamento(s)</b> serão devolvidos ao estoque da Coordenação de tecnologia educacional.
          </p>
        </div>
        <div>
          <label className="label">Motivo (opcional)</label>
          <textarea rows={3} className="input"
            placeholder="Ex.: equipamentos devolvidos para realocação..."
            value={note} onChange={e => setNote(e.target.value)}/>
        </div>
      </div>
    </Modal>
  );
}

// =============================================================
// Multi-seletor de Responsáveis (técnicos + admins)
// =============================================================
function ResponsiblesPicker({ value = [], options = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function toggle(id) {
    if (value.includes(id)) onChange(value.filter(v => v !== id));
    else onChange([...value, id]);
  }

  const selectedItems = options.filter(o => value.includes(o._id));
  const filtered = options.filter(o =>
    !search || o.name.toLowerCase().includes(search.toLowerCase())
  );

  // helpers de estilo por role
  const roleClass = (role) =>
    role === 'admin'
      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
      : role === 'atendente'
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
  const roleIcon = (role) => role === 'admin' ? '👤' : role === 'atendente' ? '☎️' : '🔧';
  const roleLabel = (role) => role === 'admin' ? 'Admin' : role === 'atendente' ? 'Atendente' : 'Técnico';

  return (
    <div className="relative" ref={ref}>
      {/* Box de exibição com chips */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="input min-h-[42px] flex flex-wrap items-center gap-1.5 text-left cursor-pointer"
      >
        {selectedItems.length === 0 ? (
          <span className="text-slate-400">Clique para selecionar...</span>
        ) : (
          selectedItems.map(item => (
            <span
              key={item._id}
              className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs font-medium ${roleClass(item.role)}`}
            >
              {roleIcon(item.role)} {item.name}
              <span
                onClick={(e) => { e.stopPropagation(); toggle(item._id); }}
                className="ml-1 w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-white/40"
              >
                ×
              </span>
            </span>
          ))
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 mt-1 w-full card max-h-72 overflow-hidden flex flex-col shadow-xl">
          <div className="p-2 border-b border-slate-200 dark:border-slate-800">
            <input
              autoFocus
              className="input !py-1.5 text-sm"
              placeholder="Buscar pessoa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-sm text-slate-500 px-3 py-3 text-center">Nenhuma pessoa encontrada</p>
            )}
            {filtered.map(opt => {
              const checked = value.includes(opt._id);
              return (
                <button
                  key={opt._id}
                  type="button"
                  onClick={() => toggle(opt._id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                    checked
                      ? 'bg-brand-50 dark:bg-brand-900/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {}}
                    className="rounded pointer-events-none"
                  />
                  <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${roleClass(opt.role)}`}>
                    {roleLabel(opt.role)}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{opt.name}</span>
                  <span className="ml-auto text-[10px] text-slate-500">{opt.email}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
