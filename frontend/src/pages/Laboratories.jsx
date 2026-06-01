import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus, Search, Pencil, Trash2, FlaskConical, Package,MonitorSmartphone,
  CheckCircle2, Hammer, Calendar, ArrowLeftCircle, Monitor, Laptop, Printer, FileText, FileType,
  Wifi, Battery, Tablet, HelpCircle, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { TableSkeleton } from '../components/Loading';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import SchoolCombobox from '../components/SchoolCombobox';
import { EQUIPMENT_TYPE_LABEL, formatDate } from '../utils/format';
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

const TYPES = ['computador','notebook','impressora','roteador','nobreak','tablet','outro'];
const CONDITIONS = [
  { v: 'novo', l: 'Novo' },
  { v: 'usado', l: 'Usado' },
  { v: 'recondicionado', l: 'Recondicionado' },
];
const TYPE_ICONS = { computador:Monitor, notebook:Laptop, impressora:Printer, roteador:Wifi, nobreak:Battery, tablet:Tablet, outro:HelpCircle };

export default function Laboratories() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', status: '', page: 1, limit: 10 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [summary, setSummary] = useState(null);
  const [deactivating, setDeactivating] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const [list, sum] = await Promise.all([
        api.get('/laboratories', { params }),
        api.get('/laboratories/summary'),
      ]);
      setItems(list.data.items);
      setPagination(list.data.pagination);
      setSummary(sum.data.data);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  async function downloadTerm(lab, format) {
    try {
      const token = localStorage.getItem('os_token');
      const res = await fetch(
        `${api.defaults.baseURL}/laboratories/${lab._id}/term/${format}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Falha ao gerar termo');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `termo-entrega-${(lab.deliveryTermNumber || lab._id).toString().replace('/', '-')}.${format === 'pdf' ? 'pdf' : 'docx'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Termo ${format.toUpperCase()} baixado`);
    } catch (err) {
      toast.error(err.message || 'Erro ao baixar termo');
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FlaskConical className="text-brand-600" size={26}/>
            Laboratórios de Informática
          </h1>
          <p className="text-sm text-slate-500">
            Cada novo laboratório debita automaticamente os equipamentos do estoque.
          </p>
        </div>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="btn-primary">
          <Plus size={16}/> Novo laboratório
        </button>
      </div>

      {/* Cards de resumo */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total" value={summary.total} color="brand" icon={MonitorSmartphone}
            onClick={() => setFilters({ q: '', status: '', page: 1, limit: 10 })}/>
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
          <input className="input pl-9" placeholder="Buscar laboratório..."
            value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value, page: 1 }))}/>
        </div>
        <select className="input" value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {loading ? <TableSkeleton cols={6}/> : items.length === 0 ? (
          <EmptyState title="Nenhum laboratório cadastrado"
            description="Clique em 'Novo laboratório' para começar."/>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead><tr>
                <th>Laboratório</th>
                <th>Escola</th>
                <th>Equipamentos</th>
                <th>Status</th>
                <th>Responsáveis</th>
                <th>Montagem</th>
                <th></th>
              </tr></thead>
              <tbody>
                {items.map(lab => {
                  const totalEq = lab.equipments.reduce((a, e) => a + e.quantity, 0);
                  return (
                    <tr key={lab._id}>
                      <td className="font-semibold">
                        <div className="flex items-center gap-2">
                          <FlaskConical size={16} className="text-brand-600 shrink-0"/>
                          {lab.name}
                        </div>
                      </td>
                      <td className="text-sm max-w-[200px] truncate">{lab.school?.name || '-'}</td>
                      <td>
                        <div className="flex items-center gap-1 flex-wrap">
                          {lab.equipments.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">sem equipamentos</span>
                          ) : lab.equipments.map((eq, i) => {
                            const Icon = TYPE_ICONS[eq.type] || HelpCircle;
                            return (
                              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs">
                                <Icon size={12}/>
                                <b>{eq.quantity}×</b> {EQUIPMENT_TYPE_LABEL[eq.type]}
                              </span>
                            );
                          })}
                        </div>
                        <span className="text-[10px] text-slate-500">{totalEq} unid. no total</span>
                      </td>
                      <td><span className={`badge ${STATUS_COLOR[lab.status]}`}>{STATUS_LABEL[lab.status]}</span></td>
                      <td className="text-sm">
                        {(lab.responsibles && lab.responsibles.length > 0) ? (
                          <div className="flex flex-wrap gap-1">
                            {lab.responsibles.map(r => (
                              <span key={r._id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${
                                r.role === 'admin'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                              }`}>
                                {r.role === 'admin' ? '👤' : '🔧'} {r.name}
                              </span>
                            ))}
                          </div>
                        ) : lab.responsibleTech?.name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            🔧 {lab.responsibleTech.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-xs">sem responsáveis</span>
                        )}
                      </td>
                      <td className="text-xs">{lab.assemblyDate ? formatDate(lab.assemblyDate).split(' ')[0] : '-'}</td>
                      <td className="flex justify-end gap-1">
                        <button onClick={() => downloadTerm(lab, 'pdf')} className="btn-ghost p-1.5 text-rose-600"
                          title="Baixar termo em PDF">
                          <FileText size={16}/>
                        </button>
                        <button onClick={() => downloadTerm(lab, 'docx')} className="btn-ghost p-1.5 text-blue-600"
                          title="Baixar termo em Word">
                          <FileType size={16}/>
                        </button>
                        {!lab.returnedToStock && lab.status !== 'desativado' && (
                          <button onClick={() => setDeactivating(lab)} className="btn-ghost p-1.5 text-amber-600"
                            title="Desativar e devolver ao estoque">
                            <ArrowLeftCircle size={16}/>
                          </button>
                        )}
                        <button onClick={() => { setEditing(lab); setOpen(true); }} className="btn-ghost p-1.5" title="Editar"><Pencil size={16}/></button>
                        {isAdmin && (
                          <button onClick={() => remove(lab)} className="btn-ghost p-1.5 text-rose-500" title="Excluir"><Trash2 size={16}/></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={pagination.page} totalPages={pagination.totalPages}
          onChange={p => setFilters(f => ({ ...f, page: p }))}/>
      </div>

      <LabForm open={open} onClose={() => setOpen(false)} lab={editing}
        onSaved={() => { setOpen(false); load(); }}/>
      <DeactivateModal lab={deactivating} onClose={() => setDeactivating(null)}
        onDone={() => { setDeactivating(null); load(); }}/>
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
// Formulário de Cadastro / Edição
// =============================================================
function LabForm({ open, onClose, lab, onSaved }) {
  const empty = {
    name: '', school: '', status: 'planejado',
    responsibles: [], assemblyDate: '', notes: '',
    equipments: [],
  };
  const [form, setForm] = useState(empty);
  const [staff, setStaff] = useState([]);  // técnicos + admins
  const [stockSummary, setStockSummary] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Carrega técnicos + admins (responsáveis pela montagem do lab)
    Promise.all([
      api.get('/users', { params: { role: 'tecnico', limit: 100 } }),
      api.get('/users', { params: { role: 'admin', limit: 100 } }),
    ]).then(([t, a]) => {
      const list = [...t.data.items, ...a.data.items];
      // remove duplicatas por _id (caso algum venha em ambos)
      const map = new Map(list.map(u => [u._id, u]));
      setStaff([...map.values()].sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(() => {});
    api.get('/stock/summary')
      .then(r => setStockSummary(r.data.data)).catch(() => {});
    setForm(lab
      ? {
          ...empty, ...lab,
          school: lab.school?._id || '',
          responsibles: lab.responsibles && lab.responsibles.length > 0
            ? lab.responsibles.map(r => r._id)
            : (lab.responsibleTech?._id ? [lab.responsibleTech._id] : []),
          assemblyDate: lab.assemblyDate ? String(lab.assemblyDate).slice(0,10) : '',
          equipments: lab.equipments || [],
        }
      : empty);
    // eslint-disable-next-line
  }, [open, lab]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function addEquip() {
    set('equipments', [...form.equipments, { type: 'computador', condition: 'novo', quantity: 1 }]);
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

  async function submit(e) {
    e?.preventDefault();
    if (!form.name.trim()) return toast.error('Informe o nome do laboratório');
    if (!form.school) return toast.error('Selecione a escola');

    setSaving(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach(k => payload[k] === '' && delete payload[k]);

      if (lab) {
        // Edição não mexe na lista de equipamentos (evita problemas com estoque)
        delete payload.equipments;
        await api.put(`/laboratories/${lab._id}`, payload);
        toast.success('Laboratório atualizado');
      } else {
        await api.post('/laboratories', payload);
        toast.success('Laboratório criado e equipamentos debitados do estoque');
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
      title={lab ? `Editar ${lab.name}` : 'Novo Laboratório de Informática'}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={submit} disabled={saving} className="btn-primary">
          {saving ? 'Salvando...' : (lab ? 'Salvar alterações' : 'Criar e debitar do estoque')}
        </button>
      </>}>
      <form onSubmit={submit} className="space-y-5">
        <section>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Informações gerais</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Nome do laboratório *</label>
              <input required className="input" placeholder='Ex.: "Laboratório de Informática - Sala 03"'
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
              <p className="text-[11px] text-slate-500 mt-1">Selecione um ou mais membros da equipe (técnicos e/ou administradores)</p>
            </div>
            <div>
              <label className="label">Data de montagem</label>
              <input type="date" className="input" value={form.assemblyDate}
                onChange={e => set('assemblyDate', e.target.value)}/>
            </div>
          </div>
        </section>

        {/* === EQUIPAMENTOS === */}
        {!lab && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Package size={16}/> Equipamentos a serem retirados do estoque
              </h3>
              <button type="button" onClick={addEquip} className="btn-secondary !py-1 !px-3 text-xs">
                <Plus size={14}/> Adicionar
              </button>
            </div>

            {form.equipments.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center text-sm text-slate-500">
                Clique em "Adicionar" para incluir equipamentos.
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
                          {TYPES.map(t => <option key={t} value={t}>{EQUIPMENT_TYPE_LABEL[t]}</option>)}
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
              💡 Ao criar o laboratório, as quantidades serão <b>retiradas automaticamente</b> do seu estoque (lotes mais antigos primeiro).
            </p>
          </section>
        )}

        {lab && (
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
                    <b>{eq.quantity}×</b> {EQUIPMENT_TYPE_LABEL[eq.type]} ({eq.condition})
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
            <b>{total} equipamento(s)</b> serão devolvidos ao estoque do Almoxarifado SEMED.
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
              className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs font-medium ${
                item.role === 'admin'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              }`}
            >
              {item.role === 'admin' ? '👤' : '🔧'} {item.name}
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
                  <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                    opt.role === 'admin'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  }`}>
                    {opt.role === 'admin' ? 'Admin' : 'Técnico'}
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
