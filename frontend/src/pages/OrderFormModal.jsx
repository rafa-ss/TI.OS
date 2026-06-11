import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { User, Phone, AlertCircle, MonitorSmartphone, Archive } from 'lucide-react';
import Modal from '../components/Modal';
import SchoolCombobox from '../components/SchoolCombobox';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import StaffPicker from '../components/StaffPicker';
import {
  SERVICE_TYPE_LABEL, EQUIPMENT_TYPE_LABEL,
  PREVENTIVE_ITEM_LABEL, CORRECTIVE_ITEM_LABEL,
} from '../utils/format';

const SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABEL);
const LAB_SERVICE_TYPES = ['manutencao_preventiva', 'manutencao_corretiva'];

// Tipos de equipamento simples — usuário só escolhe a categoria
const EQUIPMENT_TYPES = ['computador', 'notebook', 'impressora',, 'outro'];

export default function OrderFormModal({ open, onClose, order, onSaved, prefill }) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const empty = {
    requesterName: '',
    requesterPhone: '',
    school: '',
    equipmentTypes: ['computador'], // multi-seleção (array)
    serviceType: 'manutencao_corretiva',
    problemReported: '',
    priority: 'media',
    serviceLocation: 'externa',
    number: '',
    openedAt: '',
    closedAt: '',
    technician: '',
    helpers: [],
    // Laboratório
    laboratory: '',
    stations: [],            // array de codes selecionados (PC05...)
    preventiveChecklist: [],
    correctiveChecklist: [],
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState([]);
  const [labs, setLabs] = useState([]);       // laboratórios da escola
  const [labStations, setLabStations] = useState([]); // estações do lab selecionado

  const isLabService = LAB_SERVICE_TYPES.includes(form.serviceType);

  useEffect(() => {
    if (!open) return;
    // Carrega técnicos e admins (só usado pra exibir o seletor pra admin)
    if (isAdmin) {
      Promise.all([
        api.get('/users', { params: { role: 'tecnico', limit: 100 } }),
        api.get('/users', { params: { role: 'admin', limit: 100 } }),
      ]).then(([t, a]) => {
        const list = [...(t.data.items || []), ...(a.data.items || [])];
        const map = new Map(list.map(u => [u._id, u]));
        setStaff([...map.values()].sort((x, y) => x.name.localeCompare(y.name)));
      }).catch(() => {});
    }
    if (order) {
      setForm({
        requesterName: order.requesterName || '',
        requesterPhone: order.requesterPhone || '',
        school: order.school?._id || '',
        equipmentTypes: order.equipmentType
          ? order.equipmentType.split(',').map(t => t.trim()).filter(Boolean)
          : ['computador'],
        serviceType: order.serviceType || 'manutencao_corretiva',
        problemReported: order.problemReported || '',
        priority: order.priority || 'media',
        serviceLocation: order.serviceLocation || 'externa',
        number: order.number || '',
        openedAt: order.openedAt ? String(order.openedAt).slice(0, 10) : '',
        closedAt: order.closedAt ? String(order.closedAt).slice(0, 10) : '',
        technician: order.technician?._id || '',
        helpers: (order.helpers || []).map(h => h._id || h),
        laboratory: order.laboratory?._id || order.laboratory || '',
        stations: (order.stations || []).map(s => s.code),
        preventiveChecklist: order.preventiveChecklist || [],
        correctiveChecklist: order.correctiveChecklist || [],
      });
    } else {
      // Novo: aplica valores pré-preenchidos (ex.: aberto pela página do laboratório)
      setForm({ ...empty, ...(prefill || {}) });
    }
    // eslint-disable-next-line
  }, [open, order]);

  // Carrega os laboratórios da escola quando for serviço de laboratório
  useEffect(() => {
    if (!open || !isLabService || !form.school) { setLabs([]); return; }
    api.get('/laboratories', { params: { school: form.school, kind: 'laboratorio', limit: 200 } })
      .then(r => setLabs(r.data.items || []))
      .catch(() => setLabs([]));
    // eslint-disable-next-line
  }, [open, isLabService, form.school]);

  // Carrega as estações do laboratório selecionado
  useEffect(() => {
    if (!form.laboratory) { setLabStations([]); return; }
    const lab = labs.find(l => l._id === form.laboratory);
    if (lab && lab.stations) { setLabStations(lab.stations); return; }
    api.get(`/laboratories/${form.laboratory}`)
      .then(r => setLabStations(r.data.laboratory?.stations || []))
      .catch(() => setLabStations([]));
    // eslint-disable-next-line
  }, [form.laboratory, labs]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e?.preventDefault();
    if (!form.requesterName.trim()) return toast.error('Informe o nome do solicitante');
    if (!form.problemReported.trim()) return toast.error('Descreva o problema relatado');

    setSaving(true);
    try {
      const payload = { ...form };
      // converte array -> string CSV pra manter compatibilidade com o backend
      payload.equipmentType = (form.equipmentTypes || []).join(', ');
      delete payload.equipmentTypes;
      if (!payload.equipmentType) {
        toast.error('Selecione ao menos um equipamento');
        setSaving(false);
        return;
      }
      // Limpa campos de laboratório quando não for serviço de laboratório
      if (!LAB_SERVICE_TYPES.includes(payload.serviceType)) {
        payload.laboratory = '';
        payload.stations = [];
        payload.preventiveChecklist = [];
        payload.correctiveChecklist = [];
      }

      Object.keys(payload).forEach(k => payload[k] === '' && delete payload[k]);
      if (order) await api.put(`/orders/${order._id}`, payload);
      else       await api.post('/orders', payload);
      toast.success(order ? 'O.S. atualizada' : 'O.S. registrada — aguardando técnico iniciar');
      onSaved?.();
    } catch (err) {
      const data = err.response?.data;
      // Mostra exatamente quais campos falharam na validação do backend
      if (Array.isArray(data?.details) && data.details.length) {
        const msg = data.details.map(d => `${d.field}: ${d.message}`).join(' · ');
        toast.error(`${data.message || 'Erro de validação'} — ${msg}`, { duration: 6000 });
      } else {
        toast.error(data?.message || 'Erro ao salvar');
      }
    } finally { setSaving(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={order ? `Editar ${order.number}` : 'Nova Ordem de Serviço'}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'Salvando...' : (order ? 'Salvar alterações' : 'Registrar O.S.')}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        {/* SOLICITANTE */}
        <Section title="Solicitante" icon={User}>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Nome *</label>
              <input
                className="input"
                required
                placeholder="Ex.: Maria Silva"
                value={form.requesterName}
                onChange={e => set('requesterName', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Telefone</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-2.5 text-slate-400"/>
                <input
                  className="input pl-9"
                  placeholder="(91) 9 0000-0000"
                  value={form.requesterPhone}
                  onChange={e => set('requesterPhone', e.target.value)}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ESCOLA */}
        <Section title="Escola">
          <SchoolCombobox value={form.school} onChange={(id) => set('school', id)}/>
        </Section>

        {/* EQUIPAMENTO + TIPO DE SERVIÇO */}
        <Section title="Equipamento e serviço" icon={MonitorSmartphone}>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="label">
                Equipamento(s) * <span className="text-[10px] text-slate-500 font-normal">(selecione um ou mais)</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EQUIPMENT_TYPES.map(t => {
                  const checked = form.equipmentTypes?.includes(t);
                  return (
                    <button
                      type="button"
                      key={t}
                      onClick={() => {
                        const list = form.equipmentTypes || [];
                        if (checked) set('equipmentTypes', list.filter(x => x !== t));
                        else set('equipmentTypes', [...list, t]);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition ${
                        checked
                          ? 'border-pref-azul-500 bg-pref-azul-50 dark:bg-pref-azul-900/30 text-pref-azul-700 dark:text-pref-azul-200 font-medium'
                          : 'border-slate-300 dark:border-slate-700 hover:border-pref-azul-300 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!!checked}
                        readOnly
                        className="pointer-events-none accent-pref-azul-600"
                      />
                      {EQUIPMENT_TYPE_LABEL[t]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="label">Tipo de serviço *</label>
              <select
                className="input"
                value={form.serviceType}
                onChange={e => set('serviceType', e.target.value)}
              >
                {SERVICE_TYPES.map(t => (
                  <option key={t} value={t}>{SERVICE_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Prioridade *</label>
              <select
                className="input"
                value={form.priority}
                onChange={e => set('priority', e.target.value)}
              >
                <option value="baixa">🟢 Baixa</option>
                <option value="media">🔵 Média</option>
                <option value="alta">🟠 Alta</option>
                <option value="urgente">🔴 Urgente</option>
              </select>
            </div>
          </div>
        </Section>

        {/* === LABORATÓRIO (manutenção preventiva/corretiva) === */}
        {isLabService && (
          <section className="border-2 border-indigo-200 dark:border-indigo-800 rounded-xl p-4 bg-indigo-50/40 dark:bg-indigo-900/10">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
              <MonitorSmartphone size={16} className="text-indigo-600"/> Laboratório
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              {form.school
                ? 'Selecione o laboratório e as estações afetadas. Os dados de cada estação são puxados automaticamente.'
                : 'Selecione a escola acima para listar os laboratórios.'}
            </p>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label">Laboratório</label>
                <select className="input" value={form.laboratory}
                  onChange={e => set('laboratory', e.target.value) || set('stations', [])}
                  disabled={!form.school}>
                  <option value="">— selecione —</option>
                  {labs.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                </select>
                {form.school && labs.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">Nenhum laboratório nesta escola.</p>
                )}
              </div>
            </div>

            {/* Estações afetadas */}
            {form.laboratory && labStations.length > 0 && (
              <div className="mt-3">
                <label className="label">Estações afetadas</label>
                <div className="flex flex-wrap gap-2">
                  {labStations.map(st => {
                    const checked = form.stations?.includes(st.code);
                    const dot = st.status === 'funcionando' ? 'bg-emerald-500'
                      : st.status === 'manutencao' ? 'bg-amber-500'
                      : st.status === 'defeito' ? 'bg-rose-500' : 'bg-slate-300';
                    return (
                      <button type="button" key={st.code}
                        onClick={() => {
                          const list = form.stations || [];
                          set('stations', checked ? list.filter(x => x !== st.code) : [...list, st.code]);
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm font-mono transition ${
                          checked
                            ? 'border-indigo-500 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 font-semibold'
                            : 'border-slate-300 dark:border-slate-700 hover:border-indigo-300 text-slate-600 dark:text-slate-300'
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${dot}`}/> {st.code}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{form.stations?.length || 0} estação(ões) selecionada(s)</p>
              </div>
            )}

            {/* Checklist conforme o tipo */}
            {form.serviceType === 'manutencao_preventiva' && (
              <ChecklistGroup title="Manutenção preventiva — itens"
                options={PREVENTIVE_ITEM_LABEL}
                value={form.preventiveChecklist}
                onChange={(v) => set('preventiveChecklist', v)}/>
            )}
            {form.serviceType === 'manutencao_corretiva' && (
              <ChecklistGroup title="Manutenção corretiva — itens"
                options={CORRECTIVE_ITEM_LABEL}
                value={form.correctiveChecklist}
                onChange={(v) => set('correctiveChecklist', v)}/>
            )}
          </section>
        )}

        {/* LOCAL DO ATENDIMENTO */}
        <Section title="Local do atendimento" icon={MonitorSmartphone}>
          <p className="text-xs text-slate-500 mb-3">
            Onde o serviço será realizado?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => set('serviceLocation', 'ctec')}
              className={`p-4 rounded-xl border-2 text-left transition ${
                form.serviceLocation === 'ctec'
                  ? 'border-pref-azul-500 bg-pref-azul-50 dark:bg-pref-azul-900/20 ring-2 ring-pref-azul-500/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-pref-azul-300'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                🏢 Prédio SEMEC
              </div>
              <p className="text-xs text-slate-500 mt-1">
                O equipamento será trazido para a Coordenação de Tecnologia Educacional.
              </p>
            </button>
            <button
              type="button"
              onClick={() => set('serviceLocation', 'externa')}
              className={`p-4 rounded-xl border-2 text-left transition ${
                form.serviceLocation === 'externa'
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-500/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                🚗 Visita externa
              </div>
              <p className="text-xs text-slate-500 mt-1">
                O técnico irá até a escola/prédio para realizar o atendimento.
              </p>
            </button>
          </div>
        </Section>

        {/* ATENDIMENTO */}
        <Section title="Atendimento" icon={AlertCircle}>
          <label className="label">Problema relatado *</label>
          <textarea
            required
            rows={3}
            className="input"
            placeholder="Descreva o problema relatado pelo solicitante..."
            value={form.problemReported}
            onChange={e => set('problemReported', e.target.value)}
          />
        </Section>

        {/* === Campos avançados de admin (edição de número e datas) === */}
        {isAdmin && (
          <section className="border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-lg p-4 bg-amber-50/40 dark:bg-amber-900/10">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Archive size={16} className="text-amber-600"/>
              Migração / Ajustes administrativos
            </h3>
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
              Estes campos só são editáveis por administradores. Use para reaproveitar
              numeração ou ajustar datas de O.S. importadas de outro sistema.
            </p>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="label">Número da O.S.</label>
                <input
                  className="input font-mono"
                  placeholder="Ex.: 37/2024"
                  value={form.number}
                  onChange={(e) => set('number', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Data de abertura</label>
                <input
                  type="date"
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
              </div>
            </div>
            <div className="mt-3">
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
                Útil pra atribuir o técnico em O.S. importadas
              </p>
            </div>
            <div className="mt-3">
              <label className="label">Técnico(s) auxiliar(es)</label>
              <StaffPicker
                value={form.helpers}
                options={staff}
                excludeId={form.technician}
                onChange={(ids) => set('helpers', ids)}
                placeholder="Selecione um ou mais auxiliares..."
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Quando mais de uma pessoa participou do atendimento
              </p>
            </div>
          </section>
        )}

        {!order && (
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
            💡 Após registrar, a O.S. ficará <b>aberta aguardando atendimento</b>.
            Um técnico ou administrador poderá iniciá-la a partir da tela de detalhes.
          </div>
        )}
      </form>
    </Modal>
  );
}

function ChecklistGroup({ title, options, value = [], onChange }) {
  const toggle = (k) => {
    if (value.includes(k)) onChange(value.filter(x => x !== k));
    else onChange([...value, k]);
  };
  return (
    <div className="mt-3">
      <label className="label">{title}</label>
      <div className="grid sm:grid-cols-2 gap-2">
        {Object.entries(options).map(([k, label]) => {
          const checked = value.includes(k);
          return (
            <button type="button" key={k} onClick={() => toggle(k)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition ${
                checked
                  ? 'border-indigo-500 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 font-medium'
                  : 'border-slate-300 dark:border-slate-700 hover:border-indigo-300 text-slate-700 dark:text-slate-300'
              }`}>
              <input type="checkbox" checked={checked} readOnly className="pointer-events-none accent-indigo-600"/>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <section>
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
        {Icon && <Icon size={16} className="text-brand-600"/>}
        {title}
      </h3>
      {children}
    </section>
  );
}