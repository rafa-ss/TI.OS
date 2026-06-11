import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, FlaskConical, School as SchoolIcon, Users, Monitor, Package,
  Wrench, Calendar, History, ClipboardList, X, Hash,
  AlertTriangle, CheckCircle2, Loader2, Printer, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { formatDate, SERVICE_TYPE_LABEL, STATUS_LABEL as OS_STATUS_LABEL } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import OrderFormModal from './OrderFormModal';

// Cores/labels do status da estação
const ST_STATUS = {
  funcionando:    { label: 'Funcionando',  dot: 'bg-emerald-500', ring: 'ring-emerald-500', text: 'text-emerald-600' },
  manutencao:     { label: 'Manutenção',   dot: 'bg-amber-500',   ring: 'ring-amber-500',   text: 'text-amber-600' },
  defeito:        { label: 'Defeito',      dot: 'bg-rose-500',    ring: 'ring-rose-500',    text: 'text-rose-600' },
  sem_equipamento:{ label: 'Sem equipamento', dot: 'bg-slate-300 dark:bg-slate-700', ring: 'ring-slate-400', text: 'text-slate-500' },
};

const STATION_CELL_BG = {
  funcionando: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  manutencao: 'bg-amber-500 hover:bg-amber-600 text-white',
  defeito: 'bg-rose-500 hover:bg-rose-600 text-white',
  sem_equipamento: 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300',
};

export default function LaboratoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'tecnico');

  const [lab, setLab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState(null); // station object
  const [orders, setOrders] = useState([]);
  const [osFormOpen, setOsFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/laboratories/${id}`);
      setLab(data.laboratory);
      // OS relacionadas a este laboratório
      const os = await api.get('/orders', { params: { laboratory: id, limit: 50 } });
      setOrders(os.data.items || []);
    } catch {
      toast.error('Erro ao carregar laboratório');
      navigate('/laboratorios');
    } finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="animate-spin mr-2"/> Carregando...</div>;
  }
  if (!lab) return null;

  const stations = lab.stations || [];
  const totalComputers = stations.length;
  const cs = lab.computerStatus || {};
  const active = cs.active || 0;
  const maintenance = cs.maintenance || 0;
  const defective = cs.defective || 0;
  const totalEquip = (lab.equipments || []).reduce((a, e) => a + (e.quantity || 0), 0);

  // nº de colunas do mapa
  const cols = totalComputers <= 4 ? 4 : totalComputers <= 12 ? 6 : totalComputers <= 24 ? 8 : 10;

  async function refreshStation(stationId) {
    const { data } = await api.get(`/laboratories/${id}/stations/${stationId}`);
    setSelectedStation(data.station);
  }

  // Abre o Termo de Entrega (PDF) em nova aba já pronto para impressão
  async function printTerm() {
    const loadingId = toast.loading('Gerando termo para impressão...');
    try {
      const token = localStorage.getItem('os_token');
      const res = await fetch(`${api.defaults.baseURL}/laboratories/${id}/term/pdf`,
        { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Falha ao gerar termo');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        toast.dismiss(loadingId);
        toast.error('Permita janelas pop-up neste site para imprimir.');
        return;
      }
      win.addEventListener('load', () => { try { setTimeout(() => win.print(), 300); } catch {} });
      toast.dismiss(loadingId);
      toast.success('Termo aberto em nova aba');
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    } catch (err) {
      toast.dismiss(loadingId);
      toast.error(err.message || 'Erro ao gerar termo');
    }
  }

  // Baixa o Termo de Entrega em Word (DOCX)
  async function downloadTermDocx() {
    const loadingId = toast.loading('Gerando termo (Word)...');
    try {
      const token = localStorage.getItem('os_token');
      const res = await fetch(`${api.defaults.baseURL}/laboratories/${id}/term/docx`,
        { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Falha ao gerar termo');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `termo-entrega-${(lab.deliveryTermNumber || id).replace('/', '-')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.dismiss(loadingId);
      toast.success('Termo baixado');
    } catch (err) {
      toast.dismiss(loadingId);
      toast.error(err.message || 'Erro ao gerar termo');
    }
  }

  return (
    <div className="space-y-4 pb-10">
      {/* Voltar + título */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate('/laboratorios')} className="btn-ghost">
          <ArrowLeft size={18}/> Voltar
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Monitor className="text-indigo-600" size={24}/> {lab.name}
        </h1>
        {lab.deliveryTermNumber && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            <Hash size={11}/>{lab.deliveryTermNumber}
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={printTerm} className="btn-primary !bg-indigo-600 hover:!bg-indigo-700">
            <Printer size={16}/> Imprimir Termo
          </button>
          <button onClick={downloadTermDocx} className="btn-secondary">
            <FileText size={16}/> Termo (Word)
          </button>
          {canEdit && (
            <button onClick={() => setOsFormOpen(true)} className="btn-primary">
              <ClipboardList size={16}/> Abrir OS de manutenção
            </button>
          )}
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Indicator label="Computadores" value={totalComputers} icon={Monitor} color="text-slate-700 dark:text-slate-200"/>
        <Indicator label="Ativos" value={active} icon={CheckCircle2} color="text-emerald-600" dot="bg-emerald-500"/>
        <Indicator label="Manutenção" value={maintenance} icon={Wrench} color="text-amber-600" dot="bg-amber-500"/>
        <Indicator label="Defeito" value={defective} icon={AlertTriangle} color="text-rose-600" dot="bg-rose-500"/>
        <Indicator label="Equipamentos" value={totalEquip} icon={Package} color="text-indigo-600"/>
        <Indicator label="Próx. preventiva"
          value={lab.nextPreventiveAt ? formatDate(lab.nextPreventiveAt).split(' ')[0] : '—'}
          icon={Calendar}
          color={lab.preventiveOverdue ? 'text-rose-600' : (lab.preventiveDue ? 'text-amber-600' : 'text-sky-600')}
          dot={lab.preventiveOverdue ? 'bg-rose-500' : (lab.preventiveDue ? 'bg-amber-500' : undefined)}
          small/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Coluna principal: dados + mapa */}
        <div className="lg:col-span-2 space-y-4">
          {/* Dados da escola / responsáveis */}
          <div className="card p-4 grid sm:grid-cols-2 gap-4">
            <InfoBlock icon={SchoolIcon} title="Escola">
              <p className="font-medium">{lab.school?.name || '—'}</p>
              {lab.school?.inep && <p className="text-xs text-slate-500">INEP {lab.school.inep}</p>}
              {lab.school?.municipio && <p className="text-xs text-slate-500">{lab.school.municipio}</p>}
            </InfoBlock>
            <InfoBlock icon={Users} title="Responsáveis">
              {(lab.responsibles && lab.responsibles.length > 0) ? (
                <div className="flex flex-wrap gap-1">
                  {lab.responsibles.map(r => (
                    <span key={r._id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {r.name}
                    </span>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-400 italic">sem responsáveis</p>}
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <Calendar size={12}/>
                {lab.lastInspectionAt ? `Última visita: ${formatDate(lab.lastInspectionAt)}` : 'Sem visita técnica'}
              </p>
            </InfoBlock>
          </div>

          {/* Mapa visual */}
          <div className="card p-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Monitor size={18} className="text-indigo-600"/> Mapa das estações
            </h3>
            {stations.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                Nenhuma estação. As estações são geradas automaticamente conforme a quantidade de computadores no laboratório.
              </p>
            ) : (
              <>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                  {stations.map(st => (
                    <button key={st._id || st.code}
                      onClick={() => { setSelectedStation(st); }}
                      title={ST_STATUS[st.status]?.label}
                      className={`aspect-square rounded-lg flex items-center justify-center font-bold text-[11px] sm:text-xs
                        shadow-sm transition-all hover:scale-105 ${STATION_CELL_BG[st.status] || STATION_CELL_BG.sem_equipamento}
                        ${selectedStation && (selectedStation._id === st._id) ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-900' : ''}`}>
                      {st.code}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 mt-3">
                  {Object.entries(ST_STATUS).map(([k, v]) => (
                    <span key={k} className="inline-flex items-center gap-1">
                      <span className={`w-2.5 h-2.5 rounded ${v.dot}`}/> {v.label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Histórico */}
          <div className="card p-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <History size={18} className="text-slate-500"/> Histórico do laboratório
            </h3>
            {(lab.history && lab.history.length > 0) ? (
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {[...lab.history].reverse().map((h, i) => (
                  <li key={i} className="text-sm flex gap-2 border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                    <span className="text-[11px] text-slate-400 font-mono shrink-0 w-28">{formatDate(h.date)}</span>
                    <div>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{h.action}</span>
                      {h.note && <p className="text-xs text-slate-500">{h.note}</p>}
                      {h.user?.name && <p className="text-[10px] text-slate-400">por {h.user.name}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-400 italic">Sem registros.</p>}
          </div>
        </div>

        {/* Coluna lateral: OS relacionadas (fase 2) */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <ClipboardList size={18} className="text-brand-600"/> Ordens de serviço
              <span className="text-xs font-normal text-slate-400">({orders.length})</span>
            </h3>
            {orders.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Nenhuma OS vinculada a este laboratório.</p>
            ) : (
              <ul className="space-y-2 max-h-[28rem] overflow-y-auto">
                {orders.map(os => (
                  <li key={os._id}>
                    <Link to={`/ordens/${os._id}`}
                      className="block p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-brand-600">{os.number}</span>
                        <span className={`badge ${os.status === 'finalizada' || os.status === 'entregue'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : os.status === 'cancelada'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                          {OS_STATUS_LABEL[os.status] || os.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        {SERVICE_TYPE_LABEL[os.serviceType] || os.serviceType}
                      </p>
                      {(os.stations && os.stations.length > 0) && (
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {os.stations.map(s => s.code).join(', ')}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(os.openedAt)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Abrir OS de manutenção — já pré-preenchida com escola + laboratório */}
      <OrderFormModal
        open={osFormOpen}
        onClose={() => setOsFormOpen(false)}
        order={null}
        prefill={{
          school: lab.school?._id || '',
          laboratory: lab._id,
          serviceType: 'manutencao_preventiva',
          // Defaults para a OS aberta a partir do laboratório (campos obrigatórios)
          requesterName: lab.responsibles?.[0]?.name || 'Coordenação de Tecnologia',
          problemReported: `Manutenção do laboratório "${lab.name}"`,
        }}
        onSaved={() => { setOsFormOpen(false); load(); toast.success('OS de laboratório criada'); }}
      />

      {/* Painel lateral da estação */}
      {selectedStation && (
        <StationPanel
          labId={id}
          station={selectedStation}
          canEdit={canEdit}
          onClose={() => setSelectedStation(null)}
          onSaved={async () => { await load(); }}
          onRefresh={refreshStation}
        />
      )}
    </div>
  );
}

// ============== Subcomponentes ==============
function Indicator({ label, value, icon: Icon, color, dot, small }) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
        {Icon && <Icon size={13}/>} {label}
      </div>
      <div className={`mt-1 font-bold flex items-center gap-1.5 ${small ? 'text-base' : 'text-2xl'} ${color}`}>
        {dot && <span className={`w-2.5 h-2.5 rounded-full ${dot}`}/>}
        {value}
      </div>
    </div>
  );
}

function InfoBlock({ icon: Icon, title, children }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center gap-1">
        <Icon size={13}/> {title}
      </p>
      {children}
    </div>
  );
}

// ============== Painel lateral da estação ==============
function StationPanel({ labId, station, canEdit, onClose, onSaved, onRefresh }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEdit(false);
    onRefresh(station._id || station.code).catch(() => {});
    // eslint-disable-next-line
  }, [station._id]);

  function startEdit() {
    setForm({ status: station.status, notes: station.notes || '' });
    setEdit(true);
  }

  async function save() {
    setSaving(true);
    try {
      await api.put(`/laboratories/${labId}/stations/${station._id || station.code}`, {
        status: form.status,
        notes: form.notes,
      });
      toast.success(`${station.code} atualizada`);
      setEdit(false);
      await onSaved();
      await onRefresh(station._id || station.code);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao salvar estação');
    } finally { setSaving(false); }
  }

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 bg-slate-900/40 z-40" onClick={onClose}/>
      {/* painel */}
      <aside className="fixed top-0 right-0 h-full w-full max-w-md z-50 bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto animate-[slideIn_.2s_ease-out]">
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${ST_STATUS[station.status]?.dot}`}/>
            <h3 className="font-bold text-lg">{station.code}</h3>
            <span className={`text-xs font-medium ${ST_STATUS[station.status]?.text}`}>{ST_STATUS[station.status]?.label}</span>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={20}/></button>
        </div>

        <div className="p-4 space-y-4">
          {!edit ? (
            <>
              {/* Status */}
              <div className="card p-3">
                <p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Status atual</p>
                <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${ST_STATUS[station.status]?.text}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${ST_STATUS[station.status]?.dot}`}/>
                  {ST_STATUS[station.status]?.label}
                </span>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="card p-3">
                  <p className="text-[10px] uppercase text-slate-400 font-semibold">Última manutenção</p>
                  <p className="text-sm font-medium">{station.lastMaintenanceAt ? formatDate(station.lastMaintenanceAt) : '—'}</p>
                </div>
                <div className="card p-3">
                  <p className="text-[10px] uppercase text-slate-400 font-semibold">Última movimentação</p>
                  <p className="text-sm font-medium">{station.lastMovementAt ? formatDate(station.lastMovementAt) : '—'}</p>
                </div>
              </div>

              {station.notes && (
                <div className="card p-3">
                  <p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Observações</p>
                  <p className="text-sm">{station.notes}</p>
                </div>
              )}

              {canEdit && (
                <button onClick={startEdit} className="btn-primary w-full">
                  <Wrench size={16}/> Editar estação
                </button>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {Object.entries(ST_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Observações</label>
                <textarea rows={3} className="input" placeholder="Ex.: monitor piscando, aguardando peça..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}/>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEdit(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={save} disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
      <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
    </>
  );
}
