import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Search, Pencil, Trash2, Package, Wrench, CheckCircle2,
  Monitor, Laptop, Printer, Wifi, Battery, Tablet, HelpCircle, Minus, Mouse, Keyboard, Cable, MemoryStick, Plug, Power
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { TableSkeleton } from '../components/Loading';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { EQUIPMENT_TYPE_LABEL, typeLabel } from '../utils/format';

const TYPES = [
  'computador','notebook','impressora','roteador','nobreak','tablet',
  'mouse','teclado','estabilizador','caixa_cabo_rj45','monitor','memoria_ram','fonte',
  'outro'
];

const CONDITIONS = [
  { v: 'novo', l: 'Novo', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { v: 'usado', l: 'Usado', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  { v: 'recondicionado', l: 'Recondicionado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
];

const TYPE_ICONS = {
  computador: Monitor,
  notebook: Laptop,
  impressora: Printer,
  roteador: Wifi,
  nobreak: Battery,
  tablet: Tablet,
  mouse: Mouse,
  teclado: Keyboard,
  estabilizador: Plug,
  caixa_cabo_rj45: Cable,
  monitor: Monitor,
  memoria_ram: MemoryStick,
  fonte: Power,
  outro: HelpCircle,
};

export default function Equipment() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', type: '', condition: '' });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [summary, setSummary] = useState(null);
  const [allTypes, setAllTypes] = useState(TYPES);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      params.limit = 100;
      const [list, sum] = await Promise.all([
        api.get('/stock', { params }),
        api.get('/stock/summary'),
      ]);
      setItems(list.data.items);
      setSummary(sum.data.data);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/stock/types').then(r => {
      if (r.data.items?.length) setAllTypes(r.data.items);
    }).catch(() => {});
  }, []);

  async function remove(id) {
    if (!confirm('Remover este lote do estoque?')) return;
    await api.delete(`/stock/${id}`);
    toast.success('Removido'); load();
  }

  async function adjust(item, delta) {
    const newQty = Math.max(0, (item.quantity || 0) + delta);
    await api.put(`/stock/${item._id}`, { quantity: newQty });
    load();
  }

  function countByCondition(c) {
    return summary?.byCondition.find(x => x._id === c)?.total || 0;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Estoque de Equipamentos</h1>
          <p className="text-sm text-slate-500">Controle simplificado das quantidades em estoque.</p>
        </div>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="btn-primary">
          <Plus size={16}/> Novo lote
        </button>
      </div>

      {/* Cards de resumo */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard label="Total em estoque" value={summary.total} color="brand" icon={Package}
            onClick={() => setFilters({ q: '', type: '', condition: '' })}/>
          <StatCard label="Novos" value={countByCondition('novo')} color="emerald" icon={CheckCircle2}
            onClick={() => setFilters(f => ({ ...f, condition: 'novo' }))}/>
          <StatCard label="Usados" value={countByCondition('usado')} color="amber" icon={Wrench}
            onClick={() => setFilters(f => ({ ...f, condition: 'usado' }))}/>
        
        </div>
      )}

      {/* Resumo visual por tipo */}
      {summary?.byType?.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Quantidade por tipo</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {allTypes.map(t => {
              const Icon = TYPE_ICONS[t] || HelpCircle;
              const qty = summary.byType.find(x => x._id === t)?.total || 0;
              return (
                <button key={t}
                  onClick={() => setFilters(f => ({ ...f, type: t }))}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-400 hover:shadow-sm transition cursor-pointer">
                  <Icon size={22} className="text-brand-600 mb-1"/>
                  <p className="text-xs text-slate-500">{typeLabel(t)}</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{qty}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card p-4 grid md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400"/>
          <input className="input pl-9" placeholder="Buscar local, observações..."
            value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} />
        </div>
        <select className="input" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
          <option value="">Todos os tipos</option>
          {allTypes.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
        </select>
        <select className="input" value={filters.condition} onChange={e => setFilters(f => ({ ...f, condition: e.target.value }))}>
          <option value="">Todas as condições</option>
          {CONDITIONS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {loading ? <TableSkeleton cols={6}/> : items.length === 0 ? (
          <EmptyState title="Nenhum lote cadastrado" description='Clique em "Novo lote" para começar a registrar seu estoque.'/>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead><tr>
                <th>Tipo</th>
                <th>Condição</th>
                <th>Quantidade</th>
                <th>Local</th>
                <th>Observações</th>
                <th></th>
              </tr></thead>
              <tbody>
                {items.map(it => {
                  const Icon = TYPE_ICONS[it.type] || HelpCircle;
                  const cond = CONDITIONS.find(c => c.v === it.condition);
                  return (
                    <tr key={it._id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <Icon size={18} className="text-brand-600"/>
                          <span className="font-semibold">{typeLabel(it.type)}</span>
                        </div>
                      </td>
                      <td><span className={`badge ${cond?.color || ''}`}>{cond?.l || it.condition}</span></td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => adjust(it, -1)} className="btn-ghost p-1 text-rose-500" title="-1"><Minus size={14}/></button>
                          <span className="text-lg font-bold text-slate-900 dark:text-white min-w-[2.5rem] text-center">{it.quantity}</span>
                          <button onClick={() => adjust(it, +1)} className="btn-ghost p-1 text-emerald-600" title="+1"><Plus size={14}/></button>
                        </div>
                      </td>
                      <td className="text-sm">{it.location || '-'}</td>
                      <td className="text-xs max-w-[250px] truncate text-slate-500">{it.notes || '-'}</td>
                      <td className="flex justify-end gap-1">
                        <button onClick={() => { setEditing(it); setOpen(true); }} className="btn-ghost p-1.5"><Pencil size={16}/></button>
                        <button onClick={() => remove(it._id)} className="btn-ghost p-1.5 text-rose-500"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StockForm open={open} onClose={() => setOpen(false)} item={editing}
        onSaved={() => { setOpen(false); load(); }}/>
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
                   hover:border-brand-400 dark:hover:border-brand-500
                   hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0
                   transition-all duration-200 cursor-pointer
                   focus:outline-none focus:ring-2 focus:ring-brand-500/40">
        {content}
      </button>
    );
  }
  return <div className="card p-4 flex items-center gap-3">{content}</div>;
}

// =============================================================
// Formulário simples — Novo / Editar lote de estoque
// =============================================================
function StockForm({ open, onClose, item, onSaved }) {
  const empty = { type: 'computador', condition: 'novo', quantity: 1, location: 'Coordenação de tecnologia educacional', notes: '' };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [availableTypes, setAvailableTypes] = useState(TYPES);

  useEffect(() => {
    if (!open) return;
    setForm(item ? { ...empty, ...item } : empty);
    // busca lista atualizada de tipos (padrões + os customizados já cadastrados)
    api.get('/stock/types').then(r => {
      setAvailableTypes(r.data.items?.length ? r.data.items : TYPES);
    }).catch(() => setAvailableTypes(TYPES));
    // eslint-disable-next-line
  }, [open, item]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e?.preventDefault();
    if (!form.quantity || form.quantity < 1) return toast.error('Quantidade deve ser pelo menos 1');
    setSaving(true);
    try {
      const payload = { ...form, quantity: Number(form.quantity) };
      let res;
      if (item) {
        res = await api.put(`/stock/${item._id}`, payload);
        toast.success('Lote atualizado');
      } else {
        res = await api.post('/stock', payload);
        // Backend retorna { merged: true } se somou em lote existente
        if (res.data?.merged) {
          toast.success(res.data.message || `Quantidade somada ao lote existente`);
        } else {
          toast.success(`${payload.quantity} unidade(s) adicionada(s) ao estoque`);
        }
      }
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro');
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Editar lote de estoque' : 'Adicionar ao estoque'}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={submit} disabled={saving} className="btn-primary">
          {saving ? 'Salvando...' : (item ? 'Salvar' : 'Adicionar')}
        </button>
      </>}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cadastre um lote de equipamentos. Ex.: <i>"30 computadores novos no almoxarifado"</i>.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tipo *</label>
            <input
              className="input"
              list="stock-types-list"
              required
              placeholder="Selecione ou digite um tipo novo"
              value={form.type ? typeLabel(form.type) : ''}
              onChange={e => {
                // Quando o usuário digita ou escolhe da lista,
                // normalizamos: minúsculo, troca espaço por underscore
                const raw = e.target.value || '';
                const norm = raw.toLowerCase().trim().replace(/\s+/g, '_');
                set('type', norm);
              }}
            />
            <datalist id="stock-types-list">
              {availableTypes.map(t => (
                <option key={t} value={typeLabel(t)}/>
              ))}
            </datalist>
            <p className="text-[11px] text-slate-500 mt-1">
              Não está na lista? É só digitar — o novo tipo será salvo automaticamente.
            </p>
          </div>
          <div>
            <label className="label">Condição *</label>
            <select className="input" value={form.condition} onChange={e => set('condition', e.target.value)}>
              {CONDITIONS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Quantidade *</label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => set('quantity', Math.max(1, Number(form.quantity) - 1))}
              className="btn-secondary !px-3"><Minus size={16}/></button>
            <input type="number" min="1" className="input text-center text-lg font-bold"
              value={form.quantity} onChange={e => set('quantity', e.target.value)}/>
            <button type="button" onClick={() => set('quantity', Number(form.quantity) + 1)}
              className="btn-secondary !px-3"><Plus size={16}/></button>
          </div>
        </div>

        <div>
          <label className="label">Local de armazenamento</label>
          <input className="input" placeholder="Ex.: Coordenação de tecnologia educacional" value={form.location}
            onChange={e => set('location', e.target.value)}/>
        </div>

        <div>
          <label className="label">Observações (opcional)</label>
          <textarea rows={2} className="input"
            placeholder="Ex.: Recebidos via convênio MEC 2024, configuração i5/8GB..."
            value={form.notes} onChange={e => set('notes', e.target.value)}/>
        </div>
      </form>
    </Modal>
  );
}