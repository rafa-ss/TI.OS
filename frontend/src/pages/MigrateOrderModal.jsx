import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Archive, User, AlertCircle, Calendar } from 'lucide-react';
import Modal from '../components/Modal';
import SchoolCombobox from '../components/SchoolCombobox';
import api from '../services/api';
import StaffPicker from '../components/StaffPicker';
import { SERVICE_TYPE_LABEL, EQUIPMENT_TYPE_LABEL } from '../utils/format';

const SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABEL);
const EQUIPMENT_TYPES = ['computador', 'notebook', 'impressora', 'tablet', 'outro'];
const STATUS_OPTIONS = [
  { v: 'aberta',           l: 'Aberta' },
  { v: 'em_andamento',     l: 'Em andamento' },
  { v: 'aguardando_peca',  l: 'Aguardando peça' },
  { v: 'finalizada',       l: 'Finalizada' },
  { v: 'entregue',         l: 'Entregue' },
  { v: 'cancelada',        l: 'Cancelada' },
];

/**
 * Modal específico para IMPORTAR ordens de serviço de sistemas anteriores.
 * Permite definir manualmente:
 *  - Número da O.S. (qualquer formato, ex.: "37/2024", "OS-2024-00037", "37")
 *  - Data de abertura
 *  - Data de conclusão
 *  - Status final
 *  - Diagnóstico e serviço realizado
 *
 * Restrito a administradores.
 */
export default function MigrateOrderModal({ open, onClose, onSaved }) {
  const empty = {
    number: '',
    openedAt: '',
    closedAt: '',
    status: 'finalizada',
    requesterName: '',
    requesterPhone: '',
    school: '',
    equipmentType: 'computador',
    serviceType: 'manutencao_corretiva',
    problemReported: '',
    diagnosis: '',
    serviceDone: '',
    technician: '',
    helpers: [],
    priority: 'media',
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState([]); // técnicos + admins disponíveis

  useEffect(() => {
    if (!open) return;
    setForm(empty);
    Promise.all([
      api.get('/users', { params: { role: 'tecnico', limit: 100 } }),
      api.get('/users', { params: { role: 'admin', limit: 100 } }),
    ]).then(([t, a]) => {
      const list = [...(t.data.items || []), ...(a.data.items || [])];
      const map = new Map(list.map(u => [u._id, u]));
      setStaff([...map.values()].sort((x, y) => x.name.localeCompare(y.name)));
    }).catch(() => {});
    /* eslint-disable-next-line */
  }, [open]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e?.preventDefault();
    if (!form.requesterName.trim()) return toast.error('Informe o solicitante');
    if (!form.problemReported.trim()) return toast.error('Descreva o problema relatado');
    if (form.status === 'finalizada' && !form.diagnosis.trim()) {
      return toast.error('Para O.S. finalizada, informe o diagnóstico');
    }

    setSaving(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach((k) => payload[k] === '' && delete payload[k]);
      await api.post('/orders', payload);
      toast.success('O.S. antiga importada com sucesso!');
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao importar');
    } finally { setSaving(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={<span className="flex items-center gap-2"><Archive size={18}/> Importar O.S. anterior</span>}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'Importando...' : 'Importar O.S.'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        {/* Aviso */}
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm">
          <p className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
            <AlertCircle size={16} className="shrink-0 mt-0.5"/>
            <span>
              <b>Modo migração:</b> use este formulário para repassar O.S. de um sistema
              anterior. Você pode definir o número original, datas e o status final.
              Após cadastrar, esses campos não poderão mais ser alterados.
            </span>
          </p>
        </div>

        {/* === Identificação / Datas === */}
        <section>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
            <Calendar size={16} className="text-pref-azul-600"/> Identificação e datas
          </h3>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="label">Número da O.S. *</label>
              <input
                className="input font-mono"
                required
                placeholder="Ex.: 37/2024 ou OS-2024-00037"
                value={form.number}
                onChange={(e) => set('number', e.target.value)}
              />
              <p className="text-[10px] text-slate-500 mt-1">Use o mesmo número do sistema antigo</p>
            </div>
            <div>
              <label className="label">Data de abertura *</label>
              <input
                type="date"
                required
                className="input"
                value={form.openedAt}
                onChange={(e) => set('openedAt', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Data de conclusão</label>
              <input
                type="date"
                className="input"
                value={form.closedAt}
                onChange={(e) => set('closedAt', e.target.value)}
              />
              <p className="text-[10px] text-slate-500 mt-1">Deixe vazio se ainda não foi concluída</p>
            </div>
          </div>

          <div className="mt-3 grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Prioridade</label>
              <select
                className="input"
                value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
              >
                <option value="baixa">🟢 Baixa</option>
                <option value="media">🔵 Média</option>
                <option value="alta">🟠 Alta</option>
                <option value="urgente">🔴 Urgente</option>
              </select>
            </div>
          </div>
        </section>

        {/* === Solicitante / Escola === */}
        <section>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
            <User size={16} className="text-pref-azul-600"/> Solicitante e escola
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Nome do solicitante *</label>
              <input
                className="input"
                required
                value={form.requesterName}
                onChange={(e) => set('requesterName', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input
                className="input"
                value={form.requesterPhone}
                onChange={(e) => set('requesterPhone', e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="label">Escola</label>
            <SchoolCombobox value={form.school} onChange={(id) => set('school', id)} />
          </div>
        </section>

        {/* === Serviço === */}
        <section>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Serviço</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Equipamento</label>
              <select
                className="input"
                value={form.equipmentType}
                onChange={(e) => set('equipmentType', e.target.value)}
              >
                {EQUIPMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{EQUIPMENT_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tipo de serviço</label>
              <select
                className="input"
                value={form.serviceType}
                onChange={(e) => set('serviceType', e.target.value)}
              >
                {SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>{SERVICE_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <label className="label">Problema relatado *</label>
              <textarea
                required
                rows={2}
                className="input"
                value={form.problemReported}
                onChange={(e) => set('problemReported', e.target.value)}
              />
            </div>
            <div>
              <label className="label">
                Diagnóstico técnico {form.status === 'finalizada' && <span className="text-rose-500">*</span>}
              </label>
              <textarea
                rows={2}
                className="input"
                placeholder="Ex.: Fonte queimada, substituída por nova"
                value={form.diagnosis}
                onChange={(e) => set('diagnosis', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Serviço realizado</label>
              <textarea
                rows={2}
                className="input"
                placeholder="Descreva o que foi feito (será mostrado no PDF da O.S.)"
                value={form.serviceDone}
                onChange={(e) => set('serviceDone', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Técnico responsável</label>
              <select
                className="input"
                value={form.technician}
                onChange={(e) => set('technician', e.target.value)}
              >
                <option value="">— nenhum —</option>
                {staff.map(u => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.role === 'admin' ? 'Admin' : 'Técnico'})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Quem realizou esta O.S. no sistema antigo
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="label">Técnico(s) auxiliar(es)</label>
              <StaffPicker
                value={form.helpers}
                options={staff}
                excludeId={form.technician}
                onChange={(ids) => set('helpers', ids)}
                placeholder="Selecione os auxiliares que participaram..."
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Outros técnicos que participaram do atendimento
              </p>
            </div>
          </div>
        </section>
      </form>
    </Modal>
  );
}