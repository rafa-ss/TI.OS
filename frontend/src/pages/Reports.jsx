import { useEffect, useState, useCallback } from 'react';
import {
  BarChart3, FileText, FileSpreadsheet, Calendar, User as UserIcon, ClipboardList,
  FlaskConical, School as SchoolIcon, Wrench, CheckCircle2, Clock, Users, Plus,
  Pencil, Trash2, MapPin, Download, RefreshCw, ChevronDown, ChevronUp, Filter, Timer,
  ChevronLeft, ChevronRight,
  Monitor,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/Loading';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import SchoolCombobox from '../components/SchoolCombobox';
import {
  formatDateOnly, ROLE_LABEL, STATUS_LABEL, STATUS_ROW_COLOR, SERVICE_TYPE_LABEL,
} from '../utils/format';

const ACTIVITY_TYPES = [
  { v: 'montagem_lab', l: 'Montagem de laboratório' },
  { v: 'visita_tecnica', l: 'Visita técnica' },
  { v: 'manutencao', l: 'Manutenção' },
  { v: 'reuniao', l: 'Reunião' },
  { v: 'treinamento', l: 'Treinamento' },
  { v: 'outro', l: 'Outro' },
];

const STATUS_OPTIONS = [
  { v: '', l: 'Todos os status' },
  { v: 'aberta', l: 'Aberta' },
  { v: 'em_andamento', l: 'Em andamento' },
  { v: 'aguardando_peca', l: 'Aguardando peça' },
  { v: 'finalizada', l: 'Finalizada' },
  { v: 'entregue', l: 'Entregue' },
  { v: 'cancelada', l: 'Cancelada' },
];

// Cores dos gráficos por status (alinhadas ao restante do sistema)
const STATUS_CHART_COLOR = {
  aberta: '#10b981',
  em_andamento: '#f59e0b',
  aguardando_peca: '#8b5cf6',
  finalizada: '#0ea5e9',
  entregue: '#14b8a6',
  cancelada: '#f43f5e',
};
const BAR_PALETTE = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#64748b', '#eab308'];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstDayMonth() { const d = new Date(); d.setMonth(d.getMonth() - 5); d.setDate(1); return d.toISOString().slice(0, 10); }

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/**
 * Monta a série com TODOS os dias de um mês (1..último dia), preenchendo com 0
 * os dias sem O.S. Os valores vêm de byDay, cujos rótulos são "DD/MM".
 */
function buildMonthDays(byDay = [], year, month /* 0-based */) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mm = String(month + 1).padStart(2, '0');
  const counts = {};
  for (const d of byDay) counts[d.label] = d.value; // "DD/MM" -> value

  const out = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const label = `${String(day).padStart(2, '0')}/${mm}`;
    out.push({ label, value: counts[label] || 0 });
  }
  return out;
}

/** ISO yyyy-mm-dd do primeiro e último dia de um mês. */
function monthRange(year, month /* 0-based */) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: iso(first), to: iso(last) };
}

export default function Reports() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  // ===== Filtros =====
  const [filters, setFilters] = useState({
    from: firstDayMonth(),
    to: todayISO(),
    technician: '',
    school: '',
    laboratory: '',
    status: '',
    serviceType: '',
  });
  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const [staff, setStaff] = useState([]);
  const [labs, setLabs] = useState([]);

  // ===== Dados analíticos =====
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  // ===== Histórico paginado =====
  const [history, setHistory] = useState({ items: [], page: 1, totalPages: 1, total: 0 });
  const [histPage, setHistPage] = useState(1);

  // ===== Respaldo de ponto (atividades externas) =====
  const [showPonto, setShowPonto] = useState(false);

  // Carrega opções dos filtros (técnicos e laboratórios)
  useEffect(() => {
    api.get('/users/staff').then((r) => {
      setStaff((r.data.items || []).filter((u) => ['admin', 'tecnico'].includes(u.role)));
    }).catch(() => {});
    api.get('/laboratories', { params: { kind: 'laboratorio', limit: 300 } })
      .then((r) => setLabs(r.data.items || [])).catch(() => {});
  }, []);

  const cleanParams = useCallback(() => {
    const p = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v; });
    return p;
  }, [filters]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/reports/analytics', { params: cleanParams() });
      setAnalytics(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao gerar relatório');
    } finally { setLoading(false); }
  }, [cleanParams]);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/reports/history', { params: { ...cleanParams(), page: histPage, limit: 15 } });
      setHistory(data);
    } catch { /* silencioso */ }
  }, [cleanParams, histPage]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  function generate() {
    setHistPage(1);
    loadAnalytics();
    loadHistory();
    toast.success('Relatório atualizado');
  }

  // ===== Exportações =====
  function downloadFile(path, params, filename) {
    const qs = new URLSearchParams(params).toString();
    const url = `${api.defaults.baseURL}${path}${qs ? '?' + qs : ''}`;
    const token = localStorage.getItem('os_token');
    toast.loading('Gerando arquivo...', { id: 'dl' });
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        toast.success('Arquivo gerado', { id: 'dl' });
      })
      .catch(() => toast.error('Erro ao gerar arquivo', { id: 'dl' }));
  }
  const exportPdf = () => downloadFile('/reports/orders/pdf', cleanParams(), `relatorio-os-${filters.from}-a-${filters.to}.pdf`);
  const exportExcel = () => downloadFile('/reports/orders/excel', cleanParams(), `relatorio-os-${filters.from}-a-${filters.to}.xlsx`);

  return (
    <div className="space-y-5">
      {/* ===== Cabeçalho ===== */}
      <div className="card p-5 bg-gradient-to-r from-pref-azul-600 to-pref-azul-800 text-white border-0">
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 size={24} /> Relatórios Técnicos</h1>
        <p className="text-sm text-white/80 mt-0.5">Geração de relatórios e indicadores operacionais</p>
      </div>

      {/* ===== Filtros ===== */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold text-sm">
          <Filter size={15} /> Filtros
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="label flex items-center gap-1"><Calendar size={13} /> Data inicial</label>
            <input type="date" className="input" value={filters.from} onChange={(e) => setF('from', e.target.value)} />
          </div>
          <div>
            <label className="label flex items-center gap-1"><Calendar size={13} /> Data final</label>
            <input type="date" className="input" value={filters.to} onChange={(e) => setF('to', e.target.value)} />
          </div>
          <div>
            <label className="label flex items-center gap-1"><UserIcon size={13} /> Técnico</label>
            <select className="input" value={filters.technician} onChange={(e) => setF('technician', e.target.value)}>
              <option value="">Todos</option>
              {staff.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label flex items-center gap-1"><Monitor size={13} /> Laboratório</label>
            <select className="input" value={filters.laboratory} onChange={(e) => setF('laboratory', e.target.value)}>
              <option value="">Todos</option>
              {labs.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label flex items-center gap-1"><SchoolIcon size={13} /> Escola</label>
            <SchoolCombobox value={filters.school} onChange={(id) => setF('school', id || '')} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={filters.status} onChange={(e) => setF('status', e.target.value)}>
              {STATUS_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tipo de serviço</label>
            <select className="input" value={filters.serviceType} onChange={(e) => setF('serviceType', e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(SERVICE_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button onClick={generate} className="btn-primary"><RefreshCw size={16} /> Gerar Relatório</button>
          <button onClick={exportPdf} className="btn-secondary"><FileText size={16} /> Exportar PDF</button>
          <button onClick={exportExcel} className="btn-secondary"><FileSpreadsheet size={16} /> Exportar Excel</button>
        </div>
      </div>

      {loading || !analytics ? <PageLoader /> : (
        <>
          {/* ===== Indicadores Gerais (KPIs) ===== */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi label="Total de O.S." value={analytics.kpis.totalOrders} color="brand" icon={ClipboardList} />
            <Kpi label="Finalizadas" value={analytics.kpis.finalizadas} color="emerald" icon={CheckCircle2} />
            <Kpi label="Em andamento" value={analytics.kpis.pendentes} color="amber" icon={Clock} />
            <Kpi label="Técnicos ativos" value={analytics.kpis.totalTecnicos} color="indigo" icon={Users} />
            <Kpi label="Escolas" value={analytics.kpis.totalEscolas} color="sky" icon={SchoolIcon} />
            <Kpi label="Laboratórios" value={analytics.kpis.totalLabs} color="violet" icon={Monitor} />
          </div>

          {/* ===== Seção 6 — Respaldo para Ponto (atividades externas) ===== */}
                    <PontoSection
                      show={showPonto}
                      onToggle={() => setShowPonto((s) => !s)}
                      isAdmin={isAdmin}
                      user={user}
                      staff={staff}
                      range={{ from: filters.from, to: filters.to }}
                    />
          {/* ===== Seção 1 — Desempenho Operacional ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="O.S. por mês" icon={BarChart3}>
              {analytics.byMonth.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={analytics.byMonth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" name="O.S." stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </ChartCard>

            <ChartCard title="Status das O.S." icon={PieChartIcon}>
              {analytics.byStatus.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={analytics.byStatus} dataKey="value" nameKey="status" cx="50%" cy="50%"
                      innerRadius={55} outerRadius={90} paddingAngle={2}
                      label={(e) => STATUS_LABEL[e.status] || e.status}>
                      {analytics.byStatus.map((e, i) => (
                        <Cell key={i} fill={STATUS_CHART_COLOR[e.status] || BAR_PALETTE[i % BAR_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, STATUS_LABEL[n] || n]} />
                    <Legend formatter={(v) => STATUS_LABEL[v] || v} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </ChartCard>
          </div>

          {/* O.S. por dia — navegável por mês (mostra todos os dias do mês) */}
          <DailyChart
            baseFilters={{
              technician: filters.technician,
              school: filters.school,
              laboratory: filters.laboratory,
              status: filters.status,
              serviceType: filters.serviceType,
            }}
          />

          {/* ===== Seção 2 — Tipos de Atendimento ===== */}
          <ChartCard title="Quantidade por Tipo de Serviço" icon={Wrench}>
            {analytics.byType.length ? (
              <ResponsiveContainer width="100%" height={Math.max(220, analytics.byType.length * 38)}>
                <BarChart data={analytics.byType} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="type" width={150} tick={{ fontSize: 11 }}
                    tickFormatter={(t) => SERVICE_TYPE_LABEL[t] || t} />
                  <Tooltip formatter={(v) => [v, 'O.S.']} labelFormatter={(t) => SERVICE_TYPE_LABEL[t] || t} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {analytics.byType.map((_, i) => <Cell key={i} fill={BAR_PALETTE[i % BAR_PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </ChartCard>

          {/* ===== Seção 3 — Produtividade dos Técnicos ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Ranking de Técnicos" icon={Users}>
              {analytics.byTechnician.length ? (
                <div className="overflow-x-auto">
                  <table className="table-modern">
                    <thead><tr>
                      <th>#</th><th>Técnico</th>
                      <th className="text-center">Total</th>
                      <th className="text-center">Finalizadas</th>
                    </tr></thead>
                    <tbody>
                      {analytics.byTechnician.map((t, i) => (
                        <tr key={i}>
                          <td className="text-slate-400 font-bold">{i + 1}º</td>
                          <td className="font-medium">{t.name || '—'}</td>
                          <td className="text-center">{t.total}</td>
                          <td className="text-center text-emerald-600 font-semibold">{t.finalizadas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <Empty />}
            </ChartCard>

            <ChartCard title="Tempo Médio de Atendimento" icon={Timer}>
              <div className="flex flex-col items-center justify-center h-[220px] gap-2">
                <Timer size={40} className="text-pref-azul-500" />
                <p className="text-5xl font-bold text-slate-900 dark:text-white">
                  {analytics.kpis.avgHours}<span className="text-2xl text-slate-400 ml-1">h</span>
                </p>
                <p className="text-sm text-slate-500">Média entre abertura e conclusão (O.S. concluídas)</p>
              </div>
            </ChartCard>
          </div>

          {/* ===== Seção 4 — Escolas e Laboratórios ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Escolas mais atendidas" icon={SchoolIcon}>
              {analytics.bySchool.length ? (
                <ResponsiveContainer width="100%" height={Math.max(200, analytics.bySchool.length * 34)}>
                  <BarChart data={analytics.bySchool} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }}
                      tickFormatter={(n) => (n && n.length > 22 ? n.slice(0, 22) + '…' : n)} />
                    <Tooltip />
                    <Bar dataKey="total" name="O.S." fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </ChartCard>

            <ChartCard title="Laboratórios com mais chamados" icon={Monitor}>
              {analytics.byLab.length ? (
                <ResponsiveContainer width="100%" height={Math.max(200, analytics.byLab.length * 34)}>
                  <BarChart data={analytics.byLab} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }}
                      tickFormatter={(n) => (n && n.length > 22 ? n.slice(0, 22) + '…' : n)} />
                    <Tooltip />
                    <Bar dataKey="total" name="Chamados" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </ChartCard>
          </div>

          {/* ===== Seção 5 — Histórico de Atividades ===== */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <ClipboardList size={16} className="text-pref-azul-600" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                Histórico de Atividades <span className="text-slate-400 font-normal">({history.total})</span>
              </h3>
            </div>
            {history.items.length === 0 ? <Empty text="Nenhuma O.S. no período/filtros." /> : (
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead><tr>
                    <th>Nº O.S.</th><th>Data</th><th className="text-center">Técnico</th>
                    <th>Escola</th><th>Laboratório</th>
                    <th className="text-center">Tipo</th><th className="text-center">Status</th>
                    <th className="text-center">Tempo</th>
                  </tr></thead>
                  <tbody>
                    {history.items.map((o) => (
                      <tr key={o._id} className={STATUS_ROW_COLOR[o.status] || ''}>
                        <td className="font-mono font-semibold text-brand-600">{o.number}</td>
                        <td className="text-xs whitespace-nowrap">{formatDateOnly(o.openedAt)}</td>
                        <td className="text-center text-sm">{o.technician || <span className="text-slate-400 italic text-xs">—</span>}</td>
                        <td className="text-sm max-w-[160px] truncate">{o.school || '—'}</td>
                        <td className="text-sm max-w-[140px] truncate">{o.laboratory || '—'}</td>
                        <td className="text-center text-xs">{SERVICE_TYPE_LABEL[o.serviceType] || o.serviceType}</td>
                        <td className="text-center text-xs">{STATUS_LABEL[o.status] || o.status}</td>
                        <td className="text-center text-xs whitespace-nowrap">{o.hours != null ? `${o.hours}h` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={history.page} totalPages={history.totalPages} onChange={setHistPage} />
          </div>

          
        </>
      )}
    </div>
  );
}

// PieChart icon (lucide não tem um nome direto consistente — usamos BarChart como fallback visual)
function PieChartIcon(props) {
  return <BarChart3 {...props} />;
}

function Kpi({ label, value, color, icon: Icon }) {
  const colors = {
    brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    sky: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  };
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold truncate">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{value}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-3">
        {Icon && <Icon size={16} className="text-pref-azul-600" />} {title}
      </h3>
      {children}
    </div>
  );
}

function Empty({ text = 'Sem dados para exibir.' }) {
  return <p className="text-sm text-slate-400 text-center py-10">{text}</p>;
}

// ============================================================
// Gráfico "O.S. por dia" com navegação por mês (mês atual e anteriores)
// ============================================================
function DailyChart({ baseFilters = {} }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [byDay, setByDay] = useState([]);
  const [loading, setLoading] = useState(true);

  // Não deixa avançar além do mês atual
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const goPrev = () => {
    const d = new Date(year, month - 1, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth());
  };
  const goNext = () => {
    if (isCurrentMonth) return;
    const d = new Date(year, month + 1, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth());
  };

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const { from, to } = monthRange(year, month);
    const params = { from, to };
    Object.entries(baseFilters).forEach(([k, v]) => { if (v) params[k] = v; });

    api.get('/reports/analytics', { params })
      .then((r) => { if (!cancel) setByDay(r.data.data?.byDay || []); })
      .catch(() => { if (!cancel) setByDay([]); })
      .finally(() => { if (!cancel) setLoading(false); });

    return () => { cancel = true; };
    // eslint-disable-next-line
  }, [year, month, JSON.stringify(baseFilters)]);

  const data = buildMonthDays(byDay, year, month);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Calendar size={16} className="text-pref-azul-600" /> O.S. por dia
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={goPrev} className="btn-ghost p-1.5" title="Mês anterior"><ChevronLeft size={18} /></button>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 min-w-[140px] text-center">
            {NOMES_MES[month]} / {year}
          </span>
          <button onClick={goNext} disabled={isCurrentMonth}
            className={`btn-ghost p-1.5 ${isCurrentMonth ? 'opacity-30 cursor-not-allowed' : ''}`} title="Próximo mês">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-[240px] flex items-center justify-center text-sm text-slate-400">Carregando...</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} angle={-90} textAnchor="end" height={42} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" name="O.S." fill="#0ea5e9" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ============================================================
// Seção 6 — Respaldo para Ponto (mantém o recurso de atividades externas)
// ============================================================
function PontoSection({ show, onToggle, isAdmin, user, staff, range }) {
  const [targetUser, setTargetUser] = useState(user?._id || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    if (!show) return;
    setLoading(true);
    try {
      const params = { ...range };
      if (isAdmin && targetUser && targetUser !== user?._id) params.user = targetUser;
      const { data } = await api.get('/staff-reports/activities', { params });
      setData(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao carregar atividades');
    } finally { setLoading(false); }
  }, [show, range, isAdmin, targetUser, user]);

  useEffect(() => { load(); }, [load]);

  async function removeActivity(id) {
    if (!confirm('Excluir esta atividade?')) return;
    try {
      await api.delete(`/staff-reports/manual/${id}`);
      toast.success('Atividade removida');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Erro'); }
  }

  function downloadRespaldo() {
    const params = new URLSearchParams({ ...range, tipo: 'respaldo' });
    if (isAdmin && targetUser && targetUser !== user?._id) params.append('user', targetUser);
    const url = `${api.defaults.baseURL}/staff-reports/individual/pdf?${params.toString()}`;
    const token = localStorage.getItem('os_token');
    toast.loading('Gerando PDF...', { id: 'resp' });
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `respaldo-ponto-${range.from}-a-${range.to}.pdf`;
        a.click();
        toast.success('PDF gerado', { id: 'resp' });
      })
      .catch(() => toast.error('Erro ao gerar PDF', { id: 'resp' }));
  }

  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-amber-600" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Respaldo para Ponto — Atividade Externa</h3>
        </div>
        {show ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {show && (
        <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            {isAdmin && (
              <div>
                <label className="label flex items-center gap-1"><UserIcon size={13} /> Servidor</label>
                <select className="input" value={targetUser} onChange={(e) => setTargetUser(e.target.value)}>
                  <option value={user?._id}>Eu mesmo ({user?.name})</option>
                  {staff.filter((u) => u._id !== user?._id).map((u) => (
                    <option key={u._id} value={u._id}>{u.name} ({ROLE_LABEL[u.role] || u.role})</option>
                  ))}
                </select>
              </div>
            )}
            <button onClick={() => { setEditing(null); setOpenForm(true); }} className="btn-primary !py-2">
              <Plus size={15} /> Nova atividade
            </button>
            <button onClick={downloadRespaldo} className="btn-secondary !py-2">
              <Download size={15} /> Baixar Respaldo (PDF)
            </button>
          </div>

          {loading ? <PageLoader /> : !data || data.activities.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              Nenhuma atividade externa registrada neste período.
              <br /><span className="text-xs">Registre visitas, montagens, reuniões etc. — serve de respaldo do ponto.</span>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead><tr>
                  <th>Data</th><th>Saída</th><th>Retorno</th><th>Tipo</th><th>Local</th><th>Serviço executado</th><th></th>
                </tr></thead>
                <tbody>
                  {data.activities.map((a) => (
                    <tr key={a._id}>
                      <td className="whitespace-nowrap text-sm">{formatDateOnly(a.date)}</td>
                      <td className="text-xs whitespace-nowrap">{a.startTime || '—'}</td>
                      <td className="text-xs whitespace-nowrap">{a.endTime || '—'}</td>
                      <td className="text-xs">
                        <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          {ACTIVITY_TYPES.find((t) => t.v === a.type)?.l || a.type}
                        </span>
                      </td>
                      <td className="text-sm max-w-[180px] truncate">{a.school?.name || a.location || '—'}</td>
                      <td className="text-sm max-w-[280px] truncate">{a.description}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button onClick={() => { setEditing(a); setOpenForm(true); }} className="btn-ghost p-1.5"><Pencil size={14} /></button>
                          <button onClick={() => removeActivity(a._id)} className="btn-ghost p-1.5 text-rose-500"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ActivityFormModal
        open={openForm}
        item={editing}
        forUser={isAdmin && targetUser !== user?._id ? targetUser : user?._id}
        onClose={() => setOpenForm(false)}
        onSaved={() => { setOpenForm(false); load(); }}
      />
    </div>
  );
}

// ============================================================
// Modal de Atividade Externa (manual)
// ============================================================
function ActivityFormModal({ open, item, forUser, onClose, onSaved }) {
  const empty = {
    date: todayISO(), startTime: '', endTime: '', school: '', location: '',
    description: '', type: 'visita_tecnica',
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

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e?.preventDefault();
    if (!form.description.trim()) return toast.error('Descreva a atividade');
    if (!form.date) return toast.error('Informe a data');
    setSaving(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach((k) => payload[k] === '' && delete payload[k]);
      if (forUser) payload.user = forUser;
      if (item) await api.put(`/staff-reports/manual/${item._id}`, payload);
      else await api.post('/staff-reports/manual', payload);
      toast.success('Atividade salva');
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} size="md"
      title={item ? 'Editar atividade externa' : 'Registrar atividade externa'}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'Salvando...' : (item ? 'Salvar' : 'Registrar')}
          </button>
        </>
      }>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Data *</label>
            <input type="date" required className="input" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div>
            <label className="label flex items-center gap-1"><Clock size={13} /> Saída</label>
            <input type="time" className="input" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
          </div>
          <div>
            <label className="label flex items-center gap-1"><Clock size={13} /> Retorno</label>
            <input type="time" className="input" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Tipo de atividade</label>
          <select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
            {ACTIVITY_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Escola (opcional)</label>
          <SchoolCombobox value={form.school} onChange={(id) => set('school', id)} />
        </div>
        <div>
          <label className="label">Local (se não for escola)</label>
          <input className="input" placeholder="Ex.: Sede SEMEC, Posto de saúde, etc."
            value={form.location} onChange={(e) => set('location', e.target.value)} />
        </div>
        <div>
          <label className="label">Serviço executado / descrição *</label>
          <textarea required rows={3} className="input"
            placeholder="Ex.: Montagem do laboratório da EMEIF X, configuração de PCs e roteadores."
            value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
      </form>
    </Modal>
  );
}
