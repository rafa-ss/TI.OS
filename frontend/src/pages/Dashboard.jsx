import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ClipboardList, CheckCircle2, AlertTriangle, Activity, MonitorSmartphone,
  School as SchoolIcon, ArrowUpRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import api from '../services/api';
import { PageLoader } from '../components/Loading';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { formatDate } from '../utils/format';
import RecentMessagesCard from '../components/RecentMessagesCard';

const PRIORITY_COLORS = { baixa: '#94a3b8', media: '#3b82f6', alta: '#f97316', urgente: '#e11d48' };
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

/**
 * Card de KPI clicável. Aceita `to` (rota) — torna o card inteiro um botão
 * com efeito de hover e seta indicativa.
 */
function StatCard({ icon: Icon, label, value, color = 'brand', sub, to }) {
  const navigate = useNavigate();
  const clickable = !!to;

  const inner = (
    <>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center
        bg-${color}-100 text-${color}-700
        dark:bg-${color}-900/30 dark:text-${color}-300 shrink-0`}>
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider flex items-center gap-1">
          {label}
          {clickable && (
            <ArrowUpRight
              size={14}
              className="opacity-0 group-hover:opacity-100 transition text-brand-500"
            />
          )}
        </p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </>
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={() => navigate(to)}
        className="card p-5 flex items-center gap-4 text-left group w-full
                   hover:border-brand-400 dark:hover:border-brand-500
                   hover:shadow-lg hover:-translate-y-0.5
                   active:translate-y-0
                   transition-all duration-200 cursor-pointer
                   focus:outline-none focus:ring-2 focus:ring-brand-500/40"
      >
        {inner}
      </button>
    );
  }
  return <div className="card p-5 flex items-center gap-4">{inner}</div>;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/summary')
      .then(r => setData(r.data.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  if (!data) return <p>Falha ao carregar.</p>;

  const c = data.counters;
  const monthly = data.monthly.map(m => ({
    name: `${MONTHS[m._id.m-1]}/${String(m._id.y).slice(-2)}`,
    Abertas: m.abertas,
    Finalizadas: m.finalizadas,
  }));
  const pri = data.byPriority.map(p => ({ name: p._id, value: p.count }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Visão geral. Clique em um cartão para abrir a tela correspondente.
        </p>
      </div>

      {/* Cards clicáveis — cada um navega para a tela com filtros já aplicados */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          icon={ClipboardList} label="Ativas" value={c.totalAtivas} color="sky"
          sub={`${c.abertas} abertas`}
          to="/ordens?status=aberta"
        />
        <StatCard
          icon={Activity} label="Em andamento" value={c.emAndamento} color="amber"
          to="/ordens?status=em_andamento"
        />
        <StatCard
          icon={AlertTriangle} label="Atrasadas" value={c.atrasadas} color="rose"
          to="/ordens?late=true"
        />
        <StatCard
          icon={CheckCircle2} label="Finalizadas" value={c.finalizadas + c.entregues} color="emerald"
          to="/ordens?status=finalizada"
        />
        <StatCard
          icon={MonitorSmartphone} label="Equipamentos" value={c.totalEquipamentos} color="indigo"
          to="/equipamentos"
        />
        <StatCard
          icon={SchoolIcon} label="Escolas" value={c.totalEscolas} color="teal"
          to="/escolas"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4 text-slate-800 dark:text-slate-100">O.S. nos últimos 12 meses</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b822" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', color: '#fff', borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="Abertas" stroke="#3b82f6" strokeWidth={2.5} />
                <Line type="monotone" dataKey="Finalizadas" stroke="#10b981" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-4 text-slate-800 dark:text-slate-100">Prioridades</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pri} dataKey="value" nameKey="name" outerRadius={90} label>
                  {pri.map((p) => (
                    <Cell key={p.name} fill={PRIORITY_COLORS[p.name] || '#64748b'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">

        {/* Card 3: Mensagens recentes — altura igual aos outros */}
        <div className="h-[440px]">
          <RecentMessagesCard />
        </div>

        {/* Card 1: Produtividade — define a altura base dos demais */}
        <div className="card p-4 h-[440px] flex flex-col">
          <h3 className="font-semibold mb-2 text-slate-800 dark:text-slate-100">Produtividade da equipe</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.productivity}
                margin={{ top: 10, right: 12, left: -10, bottom: 28 }}
                barCategoryGap="25%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b822" />
                <XAxis
                  dataKey="technician"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', color: '#fff', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
                <Bar dataKey="finalizadas" fill="#10b981" radius={[6,6,0,0]} />
                <Bar dataKey="total" fill="#3b82f6" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 2: Últimas O.S. — altura igual ao card de produtividade */}
        <div className="card overflow-hidden h-[440px] flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Últimas O.S.</h3>
            <Link to="/ordens" className="text-xs text-brand-600 hover:underline">ver todas</Link>
          </div>
          <div className="flex-1 overflow-y-auto">
          <table className="table-modern">
            <thead>
              <tr><th>Nº</th><th>Escola</th><th>Status</th><th>Prioridade</th><th>Abertura</th></tr>
            </thead>
            <tbody>
              {data.recentOrders.map((o) => (
                <tr key={o._id}>
                  <td><Link to={`/ordens/${o._id}`} className="font-medium text-brand-600">{o.number}</Link></td>
                  <td className="max-w-[180px] truncate">{o.school?.name || '-'}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td><PriorityBadge priority={o.priority} /></td>
                  <td className="text-xs">{formatDate(o.openedAt)}</td>
                </tr>
              ))}
              {data.recentOrders.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Sem dados</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

        
      </div>
    </div>
  );
}