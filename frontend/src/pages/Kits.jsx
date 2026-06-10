import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Package, Monitor, Laptop, Mouse, Keyboard,
  Printer, Wifi, Battery, Tablet, Cpu, Cable, Zap, MemoryStick, HelpCircle,
  Power, PowerOff, Boxes,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { TableSkeleton } from '../components/Loading';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { typeLabel } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const CONDITIONS = [
  { v: 'novo', l: 'Novo' },
  { v: 'usado', l: 'Usado' },
  { v: 'recondicionado', l: 'Recondicionado' },
];

const TYPE_ICONS = {
  computador: Monitor, // notebook: Laptop,
  impressora: Printer, roteador: Wifi,
  nobreak: Battery, tablet: Tablet, mouse: Mouse, teclado: Keyboard,
  estabilizador: Zap, caixa_cabo_rj45: Cable, monitor: Monitor,
  memoria_ram: MemoryStick, fonte: Cpu, outro: HelpCircle,
};

// Ícones que o admin pode escolher pra representar um kit
const KIT_ICONS = {
  Package, Monitor, Laptop, Boxes, Cpu, Printer,
};

export default function Kits() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [kits, setKits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/kits', { params: { all: 1 } });
      setKits(r.data.items || []);
    } catch {
      toast.error('Erro ao carregar kits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() { setEditing(null); setOpen(true); }
  function openEdit(kit) { setEditing(kit); setOpen(true); }

  async function toggleActive(kit) {
    try {
      await api.put(`/kits/${kit._id}`, { active: !kit.active });
      toast.success(kit.active ? 'Kit desativado' : 'Kit ativado');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao alterar kit');
    }
  }

  async function remove(kit) {
    if (!confirm(`Remover definitivamente o kit "${kit.name}"?`)) return;
    try {
      await api.delete(`/kits/${kit._id}`, { params: { hard: 1 } });
      toast.success('Kit removido');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao remover kit');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Boxes className="text-brand-600" /> Kits de Equipamentos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Conjuntos pré-definidos que são debitados do estoque por componente ao montar um laboratório.
          </p>
        </div>
        {isAdmin && (
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> Novo Kit
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={4} />
      ) : kits.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Nenhum kit cadastrado"
          description="Crie kits para agilizar a montagem de laboratórios (ex.: Computador Completo)."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit) => {
            const KitIcon = KIT_ICONS[kit.icon] || Package;
            return (
              <div key={kit._id}
                className={`rounded-xl border p-4 transition-colors ${
                  kit.active
                    ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    : 'border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 opacity-75'
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-600 grid place-items-center">
                      <KitIcon size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{kit.name}</p>
                      {!kit.active && (
                        <span className="text-[10px] uppercase font-bold text-rose-600">Inativo</span>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleActive(kit)} className="btn-ghost p-1.5"
                        title={kit.active ? 'Desativar' : 'Ativar'}>
                        {kit.active ? <PowerOff size={15} className="text-amber-500" /> : <Power size={15} className="text-emerald-500" />}
                      </button>
                      <button onClick={() => openEdit(kit)} className="btn-ghost p-1.5" title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => remove(kit)} className="btn-ghost p-1.5 text-rose-500" title="Remover">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {kit.description && (
                  <p className="text-xs text-slate-500 mt-2">{kit.description}</p>
                )}

                <div className="mt-3 space-y-1">
                  <p className="text-[10px] uppercase font-semibold text-slate-400">Componentes</p>
                  {kit.components.map((c, i) => {
                    const Icon = TYPE_ICONS[c.type] || HelpCircle;
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <Icon size={14} className="text-brand-600" />
                        <b>{c.quantityPerKit}×</b> {typeLabel(c.type)}
                        <span className="text-[11px] text-slate-400 capitalize">({c.condition})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && (
        <KitForm open={open} onClose={() => setOpen(false)} kit={editing} onSaved={() => { setOpen(false); load(); }} />
      )}
    </div>
  );
}

// =============================================================
// Formulário de Kit (criar/editar)
// =============================================================
function KitForm({ open, onClose, kit, onSaved }) {
  const empty = { name: '', description: '', icon: 'Package', active: true, components: [{ type: 'computador', condition: 'novo', quantityPerKit: 1 }] };
  const [form, setForm] = useState(empty);
  const [types, setTypes] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) { setForm(empty); return; }
    setForm(kit ? {
      name: kit.name || '',
      description: kit.description || '',
      icon: kit.icon || 'Package',
      active: kit.active !== false,
      components: (kit.components || []).map(c => ({ ...c })),
    } : empty);

    api.get('/stock/types').then(r => setTypes(r.data.items || [])).catch(() => {});
    // eslint-disable-next-line
  }, [open, kit]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function addComp() {
    set('components', [...form.components, { type: types[0] || 'computador', condition: 'novo', quantityPerKit: 1 }]);
  }
  function updateComp(i, field, value) {
    const next = [...form.components];
    next[i] = { ...next[i], [field]: field === 'quantityPerKit' ? Math.max(1, Number(value) || 1) : value };
    set('components', next);
  }
  function removeComp(i) {
    set('components', form.components.filter((_, idx) => idx !== i));
  }

  async function submit(e) {
    e?.preventDefault();
    if (!form.name.trim()) return toast.error('Informe o nome do kit');
    const comps = form.components.filter(c => c.type && c.type.trim());
    if (comps.length === 0) return toast.error('Adicione pelo menos 1 componente');

    setSaving(true);
    try {
      const payload = { ...form, components: comps };
      if (kit) await api.put(`/kits/${kit._id}`, payload);
      else await api.post('/kits', payload);
      toast.success(kit ? 'Kit atualizado' : 'Kit criado');
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao salvar kit');
    } finally { setSaving(false); }
  }

  // Garante que o tipo atual do componente apareça mesmo se não estiver na lista
  const typeOptions = (t) => {
    const base = types.length ? types : ['computador', 'monitor', 'mouse', 'teclado', 'notebook'];
    return t && !base.includes(t) ? [t, ...base] : base;
  };

  return (
    <Modal open={open} onClose={onClose} size="lg"
      title={kit ? `Editar Kit — ${kit.name}` : 'Novo Kit'}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={submit} disabled={saving} className="btn-primary">
          {saving ? 'Salvando...' : (kit ? 'Salvar alterações' : 'Criar kit')}
        </button>
      </>}>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Nome do kit *</label>
            <input required className="input" placeholder='Ex.: "Computador Completo"'
              value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="label">Ícone</label>
            <select className="input" value={form.icon} onChange={e => set('icon', e.target.value)}>
              {Object.keys(KIT_ICONS).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Descrição</label>
          <input className="input" placeholder="Ex.: CPU + Monitor + Mouse + Teclado"
            value={form.description} onChange={e => set('description', e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />
          Kit ativo (disponível para seleção ao montar laboratórios)
        </label>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Package size={16} /> Componentes do kit
            </h3>
            <button type="button" onClick={addComp} className="btn-secondary !py-1 !px-3 text-xs">
              <Plus size={14} /> Adicionar componente
            </button>
          </div>

          <div className="space-y-2">
            {form.components.map((c, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                <div className="col-span-5">
                  <label className="text-[10px] uppercase font-semibold text-slate-500">Tipo</label>
                  <select className="input !py-1.5" value={c.type} onChange={e => updateComp(i, 'type', e.target.value)}>
                    {typeOptions(c.type).map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] uppercase font-semibold text-slate-500">Condição</label>
                  <select className="input !py-1.5" value={c.condition} onChange={e => updateComp(i, 'condition', e.target.value)}>
                    {CONDITIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] uppercase font-semibold text-slate-500">Qtd / kit</label>
                  <input type="number" min="1" className="input !py-1.5 text-center font-bold"
                    value={c.quantityPerKit} onChange={e => updateComp(i, 'quantityPerKit', e.target.value)} />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button type="button" onClick={() => removeComp(i)} className="btn-ghost p-1.5 text-rose-500" disabled={form.components.length <= 1}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            💡 Ao selecionar este kit na montagem de um laboratório, cada componente acima será debitado do estoque
            individualmente, multiplicado pela quantidade de kits.
          </p>
        </section>
      </form>
    </Modal>
  );
}
