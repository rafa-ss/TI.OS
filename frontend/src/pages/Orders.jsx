import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, FileDown, FileText, Printer, Play, Trash2, Archive, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { TableSkeleton } from '../components/Loading';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { formatDate, SERVICE_LOCATION_LABEL, SERVICE_LOCATION_COLOR, STATUS_LABEL, PRIORITY_LABEL, STATUS_ROW_COLOR } from '../utils/format';
import OrderFormModal from './OrderFormModal';
import MigrateOrderModal from './MigrateOrderModal';

const STATUS_OPTIONS = [
  { v: '', l: 'Todos status' },
  { v: 'aberta', l: 'Aberta' },
  { v: 'em_andamento', l: 'Em andamento' },
  { v: 'aguardando_peca', l: 'Aguardando peça' },
  { v: 'finalizada', l: 'Finalizada' },
  { v: 'entregue', l: 'Entregue' },
  { v: 'cancelada', l: 'Cancelada' },
];

const PRIORITY_OPTIONS = [
  { v: '', l: 'Todas prioridades' },
  { v: 'baixa', l: 'Baixa' },
  { v: 'media', l: 'Média' },
  { v: 'alta', l: 'Alta' },
  { v: 'urgente', l: 'Urgente' },
];

export default function Orders() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // Inicializa os filtros a partir da URL — assim a navegação vinda do dashboard
  // já abre com o filtro aplicado.
  const [filters, setFilters] = useState(() => ({
    q: searchParams.get('q') || '',
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    late: searchParams.get('late') || '',
    page: parseInt(searchParams.get('page') || '1', 10),
    limit: 10,
  }));

  // Sempre que os filtros mudam, sincroniza a URL (para refresh / share)
  useEffect(() => {
    const next = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v !== undefined && !(k === 'page' && v === 1) && k !== 'limit') {
        next[k] = String(v);
      }
    });
    setSearchParams(next, { replace: true });
  }, [filters, setSearchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const [list, abertas] = await Promise.all([
        api.get('/orders', { params }),
        // busca total de abertas (sem aplicar filtros locais)
        api.get('/orders', { params: { status: 'aberta', limit: 1, page: 1 } }),
      ]);
      setItems(list.data.items);
      setPagination(list.data.pagination);
      setOpenCount(abertas.data.pagination?.total || 0);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  async function startOrder(orderId) {
    if (!confirm('Deseja iniciar o atendimento desta O.S.?')) return;
    try {
      await api.post(`/orders/${orderId}/start`);
      toast.success('Atendimento iniciado');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro');
    }
  }

  async function removeOrder(order) {
    if (!confirm(`Excluir a O.S. ${order.number}? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/orders/${order._id}`);
      toast.success('O.S. excluída');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro');
    }
  }

  function canStart(order) {
    return order.status === 'aberta' && hasRole('admin', 'tecnico');
  }
  function canDeliver(order) {
    return order.status === 'finalizada' && hasRole('atendente');
  }
  function canDelete(order) {
    if (hasRole('admin')) return true;
    const isAuthor = order.createdBy?._id === user?._id || order.createdBy === user?._id;
    return isAuthor && order.status === 'aberta';
  }

  async function deliverOrder(order) {
    if (!confirm(`Confirmar a entrega da O.S. ${order.number}?`)) return;
    try {
      await api.patch(`/orders/${order._id}/status`, { status: 'entregue' });
      toast.success('Entrega registrada com sucesso');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro');
    }
  }

  async function downloadOrderPdf(order) {
    try {
      const token = localStorage.getItem('os_token');
      const res = await fetch(`${api.defaults.baseURL}/orders/${order._id}/print`,
        { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Falha ao gerar PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OS-${order.number.replace(/[\/\\]/g, '-')}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) { alert(err.message); }
  }

  function exportFile(type) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '')
    ).toString();
    const url = `${api.defaults.baseURL}/reports/orders/${type}?${params}`;
    const token = localStorage.getItem('os_token');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(b => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(b);
        link.download = `ordens-${Date.now()}.${type === 'excel' ? 'xlsx' : 'pdf'}`;
        link.click();
      });
  }

  // Sub-titulo dinâmico baseado no filtro vindo do dashboard
  const filterLabel = (() => {
    if (filters.late === 'true') return ' · atrasadas';
    if (filters.status) {
      const opt = STATUS_OPTIONS.find(o => o.v === filters.status);
      return opt ? ` · ${opt.l}` : '';
    }
    return '';
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Ordens de Serviço<span className="text-brand-600">{filterLabel}</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {hasRole('tecnico') && !hasRole('admin')
              ? 'Você vê as O.S. abertas (livres para pegar) e as que você iniciou.'
              : hasRole('atendente')
                ? 'Você pode abrir O.S. e registrar a entrega quando um técnico finalizar.'
                : 'Acompanhe, abra e atualize chamados.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button className="btn-secondary" onClick={() => exportFile('excel')}><FileDown size={16}/> Excel</button>
          <button className="btn-secondary" onClick={() => exportFile('pdf')}><FileText size={16}/> PDF</button>
          {hasRole('admin') && (
            <button className="btn-secondary"
              onClick={() => setMigrateOpen(true)}
              title="Importar O.S. de sistema anterior"
            >
              <Archive size={16}/> Importar O.S.
            </button>
          )}
          <button className="btn-primary" onClick={() => { setEditing(null); setOpenForm(true); }}>
            <Plus size={16}/> Nova O.S.
          </button>
        </div>
      </div>

      {/* Banner de O.S. aguardando atendimento */}
      {openCount > 0 && filters.status !== 'aberta' && (
        <button
          onClick={() => setFilters(f => ({ ...f, status: 'aberta', page: 1 }))}
          className="w-full card p-4 border-l-4 border-l-pref-vermelho-500 bg-pref-vermelho-50 dark:bg-pref-vermelho-900/15 hover:bg-pref-vermelho-100 dark:hover:bg-pref-vermelho-900/25 transition flex items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-full bg-pref-vermelho-500 text-white flex items-center justify-center shrink-0 animate-pulse">
            <AlertCircle size={18}/>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-pref-vermelho-700 dark:text-pref-vermelho-200">
              {openCount === 1
                ? '1 ordem de serviço aguardando atendimento'
                : `${openCount} ordens de serviço aguardando atendimento`}
            </p>
            <p className="text-xs text-pref-vermelho-600 dark:text-pref-vermelho-300">
              {hasRole('admin','tecnico')
                ? 'Clique para visualizar e iniciar o atendimento'
                : 'Aguardando técnico iniciar o atendimento'}
            </p>
          </div>
          <ArrowRight size={20} className="text-pref-vermelho-500 shrink-0"/>
        </button>
      )}

      {openCount === 0 && (
        <div className="card p-3 bg-emerald-50/60 dark:bg-emerald-900/10 border-l-4 border-l-emerald-500 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
            ✓
          </div>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
            Nenhuma ordem aguardando atendimento no momento.
          </p>
        </div>
      )}

      <div className="card p-4">
        <div className="grid md:grid-cols-5 gap-3">
          <div className="md:col-span-2 relative">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              placeholder="Buscar nº, solicitante, problema, INEP, patrimônio..."
              className="input pl-9"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))}
            />
          </div>
          <select className="input" value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}>
            {STATUS_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
          <select className="input" value={filters.priority} onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value, page: 1 }))}>
            {PRIORITY_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox" className="rounded"
              checked={filters.late === 'true'}
              onChange={(e) => setFilters(f => ({ ...f, late: e.target.checked ? 'true' : '', page: 1 }))}
            />
            <Filter size={14}/> Apenas atrasadas
          </label>
        </div>
        {(filters.status || filters.priority || filters.late === 'true' || filters.q) && (
          <button
            onClick={() => setFilters({ q: '', status: '', priority: '', late: '', page: 1, limit: 10 })}
            className="mt-3 text-xs text-brand-600 hover:underline"
          >
            ✕ Limpar filtros
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? <TableSkeleton cols={7} /> : items.length === 0 ? (
          <EmptyState title="Nenhuma O.S. encontrada" description="Tente ajustar os filtros ou criar uma nova ordem." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Solicitante</th>
                  <th>Escola</th>
                  <th className="text-center">Equipamento</th>
                  <th className="text-center">Local</th>
                  <th className="text-center">Técnico</th>
                  <th className="text-center">Prioridade</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Abertura</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr
                    key={o._id}
                    onClick={() => navigate(`/ordens/${o._id}`)}
                    className={`cursor-pointer transition-colors ${
                      STATUS_ROW_COLOR[o.status] || 'hover:bg-brand-50/60 dark:hover:bg-brand-900/10'
                    }`}
                    title="Clique para abrir a O.S."
                  >
                    <td>
                      <span className="font-semibold text-brand-600">{o.number}</span>
                    </td>
                    <td>{o.requesterName}</td>
                    <td className="max-w-[180px] truncate">{o.school?.name || '-'}</td>
                    <td className="text-center">
                      <div className="text-sm">{o.equipmentType || '-'}</div>
                      {o.patrimonio && <div className="text-xs text-slate-500">{o.patrimonio}</div>}
                    </td>
                    <td className="text-center">
                      {o.serviceLocation && (
                        <span className={`badge ${SERVICE_LOCATION_COLOR[o.serviceLocation] || ''}`}>
                          {o.serviceLocation === 'ctec' ? '🏢' : '🚗'} {SERVICE_LOCATION_LABEL[o.serviceLocation]}
                        </span>
                      )}
                    </td>
                    <td className="text-center">{o.technician?.name || <span className="text-slate-400 italic text-xs">não atribuído</span>}</td>
                    <td className="text-center">
                      {o.priority === 'urgente' ? (
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {PRIORITY_LABEL[o.priority] || o.priority}
                        </span>
                      ) : (
                        <span>{PRIORITY_LABEL[o.priority] || o.priority}</span>
                      )}
                    </td>
                    <td className="text-center">{STATUS_LABEL[o.status] || o.status}</td>
                    <td className="text-center text-xs">{formatDate(o.openedAt)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-0.5">
                        {canStart(o) && (
                          <button onClick={(e) => { e.stopPropagation(); startOrder(o._id); }}
                            title="Iniciar atendimento"
                            className="btn-ghost p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                            <Play size={14}/>
                          </button>
                        )}
                        {['finalizada', 'entregue'].includes(o.status) && (
                          <button onClick={(e) => { e.stopPropagation(); downloadOrderPdf(o); }}
                            title="Baixar PDF"
                            className="btn-ghost p-1.5 text-brand-600">
                            <FileText size={14}/>
                          </button>
                        )}
                        {canDeliver(o) && (
                          <button onClick={(e) => { e.stopPropagation(); deliverOrder(o); }}
                            title="Registrar entrega"
                            className="btn-ghost p-1.5 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20">
                            <CheckCircle2 size={14}/>
                          </button>
                        )}
                        {canDelete(o) && (
                          <button onClick={(e) => { e.stopPropagation(); removeOrder(o); }}
                            title="Excluir O.S."
                            className="btn-ghost p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20">
                            <Trash2 size={14}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onChange={(p) => setFilters(f => ({ ...f, page: p }))}
        />
      </div>

      <OrderFormModal
        open={openForm}
        onClose={() => setOpenForm(false)}
        order={editing}
        onSaved={() => { setOpenForm(false); load(); }}
      />

      <MigrateOrderModal
        open={migrateOpen}
        onClose={() => setMigrateOpen(false)}
        onSaved={() => { setMigrateOpen(false); load(); }}
      />
    </div>
  );
}
