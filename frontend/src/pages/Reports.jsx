import { useEffect, useState, useCallback } from 'react';
import {
  BarChart3, FileText, Calendar, User as UserIcon, ClipboardList, FlaskConical,
  ExternalLink, Plus, Pencil, Trash2, MapPin, Clock, Users, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/Loading';
import Modal from '../components/Modal';
import SchoolCombobox from '../components/SchoolCombobox';
import { formatDateOnly, ROLE_LABEL } from '../utils/format';

const ACTIVITY_TYPES = [
  { v: 'montagem_lab', l: 'Montagem de laboratório' },
  { v: 'visita_tecnica', l: 'Visita técnica' },
  { v: 'manutencao', l: 'Manutenção' },
  { v: 'reuniao', l: 'Reunião' },
  { v: 'treinamento', l: 'Treinamento' },
  { v: 'outro', l: 'Outro' },
];

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function firstDayMonth() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export default function Reports() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  // Filtros
  const [from, setFrom] = useState(firstDayMonth());
  const [to, setTo] = useState(todayISO());
  const [targetUser, setTargetUser] = useState(user?._id || '');
  const [staff, setStaff] = useState([]);

  // Dados
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [openForm, setOpenForm] = useState(false);

  // Para admin: dados do "geralzão"
  const [team, setTeam] = useState(null);
  const [showTeam, setShowTeam] = useState(false);

  // Carrega lista de staff (só admin)
  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([
      api.get('/users', { params: { role: 'tecnico', limit: 100 } }),
      api.get('/users', { params: { role: 'admin', limit: 100 } }),
    ]).then(([t, a]) => {
      const list = [...(t.data.items || []), ...(a.data.items || [])];
      const map = new Map(list.map(u => [u._id, u]));
      setStaff([...map.values()].sort((x, y) => x.name.localeCompare(y.name)));
    }).catch(() => {});
  }, [isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { from, to };
      if (isAdmin && targetUser) params.user = targetUser;
      const { data } = await api.get('/staff-reports/activities', { params });
      setData(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao carregar');
    } finally { setLoading(false); }
  }, [from, to, targetUser, isAdmin]);

  useEffect(() => { load(); }, [load]);

  async function loadTeam() {
    try {
      const { data } = await api.get('/staff-reports/team-overview', { params: { from, to } });
      setTeam(data);
      setShowTeam(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro');
    }
  }

  async function removeActivity(id) {
    if (!confirm('Excluir esta atividade?')) return;
    try {
      await api.delete(`/staff-reports/manual/${id}`);
      toast.success('Atividade removida');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro');
    }
  }

  function download(type) {
    const params = new URLSearchParams({ from, to });
    if (isAdmin && targetUser && type !== 'team') params.append('user', targetUser);
    if (type === 'respaldo') params.append('tipo', 'respaldo');

    const path = type === 'team' ? '/staff-reports/team/pdf' : '/staff-reports/individual/pdf';
    const url = `${api.defaults.baseURL}${path}?${params.toString()}`;

    const token = localStorage.getItem('os_token');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const userName = (data?.user?.name || 'relatorio').replace(/\s+/g, '_');
        a.download = type === 'team'
          ? `relatorio-equipe-${from}-a-${to}.pdf`
          : `${type === 'respaldo' ? 'respaldo-ponto' : 'relatorio'}-${userName}-${from}-a-${to}.pdf`;
        a.click();
      })
      .catch(() => toast.error('Erro ao gerar PDF'));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 size={22}/> Relatórios de Atividades
          </h1>
          <p className="text-sm text-slate-500">
            {isAdmin
              ? 'Acompanhe a produtividade da equipe e gere documentos oficiais.'
              : 'Acompanhe suas atividades e gere o respaldo de ponto.'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={loadTeam} className="btn-secondary">
            <Users size={16}/> Ver "Geralzão" da equipe
          </button>
        )}
      </div>

      {/* === FILTROS === */}
      <div className="card p-4 grid md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="label flex items-center gap-1"><Calendar size={13}/> De</label>
          <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)}/>
        </div>
        <div>
          <label className="label flex items-center gap-1"><Calendar size={13}/> Até</label>
          <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)}/>
        </div>
        {isAdmin && (
          <div>
            <label className="label flex items-center gap-1"><UserIcon size={13}/> Servidor</label>
            <select className="input" value={targetUser} onChange={e => setTargetUser(e.target.value)}>
              <option value="">Eu mesmo ({user?.name})</option>
              {staff.filter(u => u._id !== user?._id).map(u => (
                <option key={u._id} value={u._id}>
                  {u.name} ({ROLE_LABEL[u.role] || u.role})
                </option>
              ))}
            </select>
          </div>
        )}
        <button onClick={load} className="btn-primary">Atualizar</button>
      </div>

      {loading || !data ? <PageLoader/> : (
        <>
          {/* === Resumo === */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="O.S. atendidas" value={data.summary.totalOrders} color="brand" icon={ClipboardList}/>
            <Stat label="O.S. finalizadas" value={data.summary.ordersFinalized} color="emerald" icon={ClipboardList}/>
            <Stat label="Laboratórios" value={data.summary.totalLabs} color="indigo" icon={FlaskConical}/>
            <Stat label="Ativ. externas" value={data.summary.totalActivities} color="amber" icon={MapPin}/>
          </div>

          {/* === Botões de download === */}
          <div className="card p-4 flex flex-wrap gap-2">
            <button onClick={() => download('completo')} className="btn-primary">
              <Download size={16}/> Baixar Relatório Geral (PDF)
            </button>
            <button onClick={() => download('respaldo')} className="btn-secondary">
              <FileText size={16}/> Baixar Respaldo de Ponto (PDF)
            </button>
          </div>

          {/* === Atividades externas (CRUD manual) === */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-amber-600"/>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                  Atividades Externas (Respaldo do Ponto)
                </h3>
              </div>
              <button onClick={() => { setEditing(null); setOpenForm(true); }} className="btn-primary !py-1.5 text-sm">
                <Plus size={14}/> Nova atividade
              </button>
            </div>

            {data.activities.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500 text-center">
                Nenhuma atividade externa registrada neste período.
                <br/><span className="text-xs">Use este recurso para registrar visitas, montagens de lab, reuniões etc. — serve de respaldo do ponto.</span>
              </p>
            ) : (
              <table className="table-modern">
                <thead><tr>
                  <th>Data</th><th>Horário</th><th>Tipo</th><th>Local</th><th>Descrição</th><th></th>
                </tr></thead>
                <tbody>
                  {data.activities.map(a => (
                    <tr key={a._id}>
                      <td className="whitespace-nowrap">{formatDateOnly(a.date)}</td>
                      <td className="text-xs whitespace-nowrap">
                        {a.startTime && a.endTime ? `${a.startTime} – ${a.endTime}` : (a.startTime || '—')}
                      </td>
                      <td className="text-xs">
                        <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          {ACTIVITY_TYPES.find(t => t.v === a.type)?.l || a.type}
                        </span>
                      </td>
                      <td className="text-sm max-w-[200px] truncate">{a.school?.name || a.location || '-'}</td>
                      <td className="text-sm max-w-[300px] truncate">{a.description}</td>
                      <td className="flex justify-end gap-1">
                        <button onClick={() => { setEditing(a); setOpenForm(true); }} className="btn-ghost p-1.5"><Pencil size={14}/></button>
                        <button onClick={() => removeActivity(a._id)} className="btn-ghost p-1.5 text-rose-500"><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* === O.S. atendidas === */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <ClipboardList size={16} className="text-pref-azul-600"/>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Ordens de Serviço Atendidas ({data.orders.length})</h3>
            </div>
            {data.orders.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500 text-center">Nenhuma O.S. neste período.</p>
            ) : (
              <table className="table-modern">
                <thead><tr><th>Nº</th><th>Data</th><th>Escola</th><th>Problema</th><th>Status</th></tr></thead>
                <tbody>
                  {data.orders.map(o => (
                    <tr key={o._id}>
                      <td className="font-mono text-xs">{o.number}</td>
                      <td className="text-xs">{formatDateOnly(o.openedAt)}</td>
                      <td className="text-sm max-w-[200px] truncate">{o.school?.name || '-'}</td>
                      <td className="text-sm max-w-[300px] truncate">{o.problemReported}</td>
                      <td className="text-xs">
                        <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{o.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* === Laboratórios === */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <FlaskConical size={16} className="text-indigo-600"/>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Laboratórios ({data.labs.length})</h3>
            </div>
            {data.labs.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500 text-center">Nenhum laboratório neste período.</p>
            ) : (
              <table className="table-modern">
                <thead><tr><th>Nome</th><th>Escola</th><th>Status</th><th>Data</th></tr></thead>
                <tbody>
                  {data.labs.map(l => (
                    <tr key={l._id}>
                      <td className="text-sm font-medium">{l.name}</td>
                      <td className="text-sm">{l.school?.name || '-'}</td>
                      <td className="text-xs">{l.status}</td>
                      <td className="text-xs">{formatDateOnly(l.assemblyDate || l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <ActivityFormModal
        open={openForm}
        item={editing}
        forUser={targetUser || user?._id}
        onClose={() => setOpenForm(false)}
        onSaved={() => { setOpenForm(false); load(); }}
      />

      {/* === Modal Team Overview (admin) === */}
      <Modal
        open={showTeam}
        onClose={() => setShowTeam(false)}
        size="lg"
        title={`Geralzão da equipe (${from} a ${to})`}
        footer={
          <>
            <button onClick={() => setShowTeam(false)} className="btn-secondary">Fechar</button>
            <button onClick={() => download('team')} className="btn-primary">
              <Download size={16}/> Baixar PDF
            </button>
          </>
        }
      >
        {team ? (
          <table className="table-modern">
            <thead><tr>
              <th>Servidor</th>
              <th className="text-center">O.S.</th>
              <th className="text-center">Finalizadas</th>
              <th className="text-center">Labs</th>
              <th className="text-center">Externas</th>
              <th className="text-center">Total</th>
            </tr></thead>
            <tbody>
              {team.members.map(m => (
                <tr key={m._id}>
                  <td><span className="font-medium">{m.name}</span> <span className="text-xs text-slate-500">{ROLE_LABEL[m.role]}</span></td>
                  <td className="text-center">{m.orders}</td>
                  <td className="text-center text-emerald-600 font-semibold">{m.finalized}</td>
                  <td className="text-center">{m.labs}</td>
                  <td className="text-center">{m.activities}</td>
                  <td className="text-center font-bold text-pref-azul-600">{m.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <PageLoader/>}
      </Modal>
    </div>
  );
}

function Stat({ label, value, color, icon: Icon }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-${color}-100 text-${color}-700 dark:bg-${color}-900/30 dark:text-${color}-300`}>
        <Icon size={20}/>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ============================================================
// Modal de Atividade Externa (manual)
// ============================================================
function ActivityFormModal({ open, item, forUser, onClose, onSaved }) {
  const empty = {
    date: todayISO(),
    startTime: '',
    endTime: '',
    school: '',
    location: '',
    description: '',
    type: 'visita_tecnica',
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(item
      ? { ...empty, ...item, date: item.date ? String(item.date).slice(0, 10) : todayISO(), school: item.school?._id || '' }
      : empty);
    // eslint-disable-next-line
  }, [open, item]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e?.preventDefault();
    if (!form.description.trim()) return toast.error('Descreva a atividade');
    if (!form.date) return toast.error('Informe a data');

    setSaving(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach(k => payload[k] === '' && delete payload[k]);
      if (forUser) payload.user = forUser;
      if (item) await api.put(`/staff-reports/manual/${item._id}`, payload);
      else      await api.post('/staff-reports/manual', payload);
      toast.success('Atividade salva');
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={item ? 'Editar atividade externa' : 'Registrar atividade externa'}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'Salvando...' : (item ? 'Salvar' : 'Registrar')}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Data *</label>
            <input type="date" required className="input" value={form.date}
              onChange={e => set('date', e.target.value)}/>
          </div>
          <div>
            <label className="label flex items-center gap-1"><Clock size={13}/> Início</label>
            <input type="time" className="input" value={form.startTime}
              onChange={e => set('startTime', e.target.value)}/>
          </div>
          <div>
            <label className="label flex items-center gap-1"><Clock size={13}/> Fim</label>
            <input type="time" className="input" value={form.endTime}
              onChange={e => set('endTime', e.target.value)}/>
          </div>
        </div>

        <div>
          <label className="label">Tipo de atividade</label>
          <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
            {ACTIVITY_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Escola (opcional)</label>
          <SchoolCombobox value={form.school} onChange={(id) => set('school', id)}/>
        </div>

        <div>
          <label className="label">Local (se não for escola)</label>
          <input className="input" placeholder="Ex.: Sede SEMEC, Posto de saúde, etc."
            value={form.location} onChange={e => set('location', e.target.value)}/>
        </div>

        <div>
          <label className="label">Descrição da atividade *</label>
          <textarea required rows={3} className="input"
            placeholder="Ex.: Acompanhei a equipe na montagem do laboratório da EMEIF X. Configurei os PCs e roteadores."
            value={form.description} onChange={e => set('description', e.target.value)}/>
        </div>
      </form>
    </Modal>
  );
}
