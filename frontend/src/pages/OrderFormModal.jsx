import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { User, Phone, AlertCircle, MonitorSmartphone } from 'lucide-react';
import Modal from '../components/Modal';
import SchoolCombobox from '../components/SchoolCombobox';
import api from '../services/api';
import { SERVICE_TYPE_LABEL, EQUIPMENT_TYPE_LABEL } from '../utils/format';

const SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABEL);

// Tipos de equipamento simples — usuário só escolhe a categoria
const EQUIPMENT_TYPES = ['computador', 'notebook', 'impressora', 'tablet', 'outro'];

export default function OrderFormModal({ open, onClose, order, onSaved }) {
  const empty = {
    requesterName: '',
    requesterPhone: '',
    school: '',
    equipmentType: 'computador',
    serviceType: 'manutencao_corretiva',
    problemReported: '',
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (order) {
      setForm({
        requesterName: order.requesterName || '',
        requesterPhone: order.requesterPhone || '',
        school: order.school?._id || '',
        equipmentType: order.equipmentType || 'computador',
        serviceType: order.serviceType || 'manutencao_corretiva',
        problemReported: order.problemReported || '',
      });
    } else {
      setForm(empty);
    }
    // eslint-disable-next-line
  }, [open, order]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e?.preventDefault();
    if (!form.requesterName.trim()) return toast.error('Informe o nome do solicitante');
    if (!form.problemReported.trim()) return toast.error('Descreva o problema relatado');

    setSaving(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach(k => payload[k] === '' && delete payload[k]);
      if (order) await api.put(`/orders/${order._id}`, payload);
      else       await api.post('/orders', payload);
      toast.success(order ? 'O.S. atualizada' : 'O.S. registrada — aguardando técnico iniciar');
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao salvar');
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
            <div>
              <label className="label">Equipamento *</label>
              <select
                className="input"
                value={form.equipmentType}
                onChange={e => set('equipmentType', e.target.value)}
              >
                {EQUIPMENT_TYPES.map(t => (
                  <option key={t} value={t}>{EQUIPMENT_TYPE_LABEL[t]}</option>
                ))}
              </select>
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
