import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FlaskConical, XCircle, CalendarClock, Eye, Package, PackageMinus,
  ClipboardList, Clock, Activity, CheckCircle2, AlertTriangle, Bell, ArrowUpRight,
  Boxes, Monitor, ChevronRight, Loader2, ShieldCheck, RefreshCw, Layers, AlertCircle,
} from 'lucide-react';
import api from '../services/api';
import { formatDate, typeLabel, STATUS_LABEL, STATUS_ROW_COLOR } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import RecentMessagesCard from '../components/RecentMessagesCard';

// Mapa de ícones para a central de alertas (vem como string do backend)
const ALERT_ICONS = { CalendarClock, XCircle, PackageMinus, Clock, Eye, AlertTriangle };

const ALERT_STYLE = {
  critical: {
    wrap: 'border-rose-500/40 bg-rose-50 dark:bg-rose-900/15',
    dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400',
  },
  warning: {
    wrap: 'border-amber-500/40 bg-amber-50 dark:bg-amber-900/15',
    dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    wrap: 'border-sky-500/40 bg-sky-50 dark:bg-sky-900/15',
    dot: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400',
  },
};

const HEALTH = {
  ok:        { cell: 'bg-emerald-500', label: 'Operacional' },
  manutencao:{ cell: 'bg-amber-500',   label: 'Em manutenção' },
  defeito:   { cell: 'bg-rose-500',    label: 'Com defeito' },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(new Date());
  const [error, setError] = useState(null);

  async function load(silent = false) {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const r = await api.get('/dashboard/noc');
      setD(r.data.data);
      setError(null);
    } catch (err) {
      console.error('Dashboard load error:', err?.response?.data || err.message);
      setError(err?.response?.data?.message || err.message || 'Erro desconhecido');
    }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => {
    load();
    // auto-refresh a cada 60s (sensação de painel ao vivo)
    const i = setInterval(() => load(true), 60000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(i); clearInterval(clock); };
    // eslint-disable-next-line
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="animate-spin mr-2"/> Carregando painel...</div>;
  }
  if (!d) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
      <p className="text-slate-600 dark:text-slate-300 font-medium mb-2">Falha ao carregar o painel</p>
      {error && (
        <p className="text-sm text-slate-400 max-w-md bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
          {error}
        </p>
      )}
      <button 
        onClick={() => load()} 
        className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition"
      >
        Tentar novamente
      </button>
    </div>
  );

  const { labs, estoque, os, alertas } = d;
  const firstName = (user?.name || '').split(' ')[0] || 'Equipe';
  const critical = alertas.filter(a => a.level === 'critical').length;

  return (
    <div className="space-y-5">
      {/* ===== Cabeçalho / Saudação ===== */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-950 text-white p-5 shadow-lg ring-1 ring-white/10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-brand-300 font-semibold flex items-center gap-1.5">
              <ShieldCheck size={14}/> Coordenação de Tecnologia Educacional
            </p>
            <h1 className="text-2xl font-bold mt-1">{greeting()}, {firstName} 👋</h1>
            <p className="text-sm text-slate-300 mt-0.5">
              {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              {' · '}
              <span className="font-mono">{now.toLocaleTimeString('pt-BR')}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              critical > 0 ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
                : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'}`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${critical > 0 ? 'bg-rose-400' : 'bg-emerald-400'}`}/>
              {critical > 0 ? `${critical} alerta(s) crítico(s)` : 'Tudo operacional'}
            </div>
            <button onClick={() => load(true)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition" title="Atualizar">
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/>
            </button>
          </div>
        </div>
      </div>

      {/* ===== Faixa de KPIs (misto: laboratórios + O.S.) ===== */}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
          <Monitor size={13}/> Laboratórios
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          <Kpi to="/laboratorios" icon={Monitor} color="indigo" label="Labs ativos" value={labs.ativos}/>
          <Kpi to="/laboratorios" icon={XCircle} color="rose" label="Com defeito" value={labs.comDefeito} pulse={labs.comDefeito > 0}/>
          <Kpi to="/laboratorios" icon={Eye} color="amber" label="Sem vistoria" value={labs.semVistoria}/>
          <Kpi to="/equipamentos" icon={Boxes} color="emerald" label="Estoque" value={estoque.total} sub="unidades"/>
        </div>
      </div>

      {/* ===== Linha 1: Mapa (80%) + Alertas (20%) — altura fixa = 8 labs ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Mapa dos laboratórios — 80% */}
        <div className="xl:col-span-4">
          <Panel
            title="Mapa dos Laboratórios"
            icon={Monitor}
            count={labs.mapa.length}
            to="/laboratorios"
            className="flex flex-col"
          >
            {labs.mapa.length === 0 ? (
              <Empty icon={Monitor} text="Nenhum laboratório cadastrado."/>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 flex-1 content-start">
                  {labs.mapa.map(l => <LabMiniCard key={l._id} lab={l}/>)}
                </div>
                <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Legend dot="bg-emerald-500" label="Operacional"/>
                  <Legend dot="bg-amber-500" label="Em manutenção"/>
                  <Legend dot="bg-rose-500" label="Com defeito"/>
                  <Legend dot="bg-slate-300 dark:bg-slate-600" label="Vazio"/>
                </div>
              </>
            )}
          </Panel>
        </div>

        {/* Central de alertas — 20% */}
        <div className="xl:col-span-1">
          <Panel
            title="Alertas"
            icon={Bell}
            count={alertas.length}
            accent={critical > 0 ? 'rose' : 'slate'}
            className="h-full flex flex-col"
          >
          {alertas.length === 0 ? (
            <Empty icon={CheckCircle2} text="Tudo sob controle."/>
          ) : (
            <div className="space-y-2 overflow-y-auto pr-1 flex-1">
              {alertas.map((a, i) => {
                const Icon = ALERT_ICONS[a.icon] || AlertTriangle;
                const st = ALERT_STYLE[a.level] || ALERT_STYLE.info;
                return (
                  <Link key={i} to={a.link || '#'}
                    className={`flex items-start gap-2 p-2 rounded-lg border ${st.wrap} hover:shadow-sm transition group`}>
                    <span className={`mt-0.5 shrink-0 ${st.text}`}><Icon size={15}/></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 leading-tight">{a.title}</p>
                      {a.detail && <p className="text-[11px] text-slate-500 truncate">{a.detail}</p>}
                    </div>
                  </Link>
                );
              })}
            </div>
       
          )}
        </Panel>
         </div>
      </div>

      {/* ===== Linha 2: Últimas O.S. (80%) + Mensagens (20%) — mesma altura fixa ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

        {/* Mensagens recentes (chat da equipe) — 20% */}
        <div className="h-[350px]">
          <RecentMessagesCard />
        </div>
        {/* Últimas Ordens de Serviço — 80% */}
        <div className="xl:col-span-4">
          <Panel title="Últimas Ordens de Serviço" icon={ClipboardList} to="/ordens"
            className="h-[350px] flex flex-col">
            {os.ultimas.length === 0 ? (
              <Empty icon={ClipboardList} text="Nenhuma O.S. registrada."/>
            ) : (
              <div className="overflow-y-auto -mx-1 flex-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <th className="py-2 px-2">Nº</th>
                      <th className="py-2 px-2">Escola / Lab</th>
                      <th className="py-2 px-2 hidden sm:table-cell text-center">Equipamento</th>
                      <th className="py-2 px-2 text-center">Status</th>
                      <th className="py-2 px-2 hidden md:table-cell text-center">Abertura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {os.ultimas.map(o => (
                      <tr key={o._id}
                        onClick={() => navigate(`/ordens/${o._id}`)}
                        title="Clique para abrir a O.S."
                        className={`cursor-pointer border-b border-slate-50 dark:border-slate-800/60 transition ${STATUS_ROW_COLOR[o.status] || 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
                        <td className="py-2 px-2">
                          <span className="font-mono font-bold text-brand-600">{o.number}</span>
                        </td>
                        <td className="py-2 px-2 min-w-0">
                          <p className="truncate max-w-[220px]">{o.laboratory?.name || o.school?.name || '—'}</p>
                        </td>
                        <td className="py-2 px-2 hidden sm:table-cell text-center">
                          <div className="text-sm">{o.equipmentType || '-'}</div>
                          {o.patrimonio && <div className="text-xs text-slate-500">{o.patrimonio}</div>}
                        </td>
                        <td className="py-2 px-2 text-center">{STATUS_LABEL[o.status] || o.status}</td>
                        <td className="py-2 px-2 hidden md:table-cell text-slate-400 text-xs text-center">{formatDate(o.openedAt).split(' ')[0]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* ===== Movimentações de estoque ===== */}
      <Panel title="Movimentações de estoque" icon={Layers} count={estoque.ultimos.length}>
        {estoque.baixo.length > 0 && (
          <div className="mb-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/15 border border-amber-300/40 text-[12px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
            <PackageMinus size={14}/>
            <span><b>Estoque baixo:</b> {estoque.baixo.map(b => `${typeLabel(b.type)} (${b.inStock})`).join(', ')}</span>
          </div>
        )}
        {estoque.ultimos.length === 0 ? (
          <Empty icon={Package} text="Sem movimentações recentes."/>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4">
            {estoque.ultimos.map((s, i) => (
              <div key={s._id || i} className="row">
                <div className="min-w-0">
                  <p className="row-title">{typeLabel(s.type)} <span className="text-slate-400 font-normal">· {s.condition}</span></p>
                  <p className="row-sub">{s.location || 'Estoque'} · {formatDate(s.updatedAt).split(' ')[0]}</p>
                </div>
                <span className="badge-emerald">{s.quantity}x</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* estilos utilitários locais (linhas das listas) */}
      <style>{`
        /* Altura fixa dos painéis (cabe ~8 cards de lab em 2 linhas de 4) */
        .noc-fixed{height:440px;}
        @media (max-width: 1280px){ .noc-fixed{height:auto;min-height:300px;} }
        .row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:10px;}
        .row:hover{background:rgb(248 250 252);}
        .dark .row:hover{background:rgb(30 41 59 / .5);}
        .row-title{font-size:13px;font-weight:600;color:rgb(30 41 59);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .dark .row-title{color:rgb(241 245 249);}
        .row-sub{font-size:11px;color:rgb(100 116 139);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .badge-rose{font-size:11px;font-weight:700;color:rgb(225 29 72);background:rgb(254 226 226);padding:2px 8px;border-radius:999px;white-space:nowrap;}
        .dark .badge-rose{background:rgb(159 18 57 / .3);color:rgb(253 164 175);}
        .badge-amber{font-size:11px;font-weight:700;color:rgb(217 119 6);background:rgb(254 243 199);padding:2px 8px;border-radius:999px;white-space:nowrap;}
        .dark .badge-amber{background:rgb(146 64 14 / .3);color:rgb(252 211 77);}
        .badge-emerald{font-size:11px;font-weight:700;color:rgb(5 150 105);background:rgb(209 250 229);padding:2px 8px;border-radius:999px;white-space:nowrap;}
        .dark .badge-emerald{background:rgb(6 78 59 / .4);color:rgb(110 231 183);}
      `}</style>
    </div>
  );
}

// ============== Subcomponentes ==============
function Kpi({ icon: Icon, label, value, color, sub, to, pulse }) {
  return (
    <Link to={to || '#'}
      className="group relative card !p-3 flex items-center gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden">
      <div className={`w-10 h-10 rounded-lg grid place-items-center shrink-0
        bg-${color}-100 text-${color}-700 dark:bg-${color}-900/30 dark:text-${color}-300`}>
        <Icon size={18}/>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold truncate">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white leading-tight flex items-center gap-1">
          {value}
          {pulse && <span className={`w-1.5 h-1.5 rounded-full bg-${color}-500 animate-pulse`}/>}
        </p>
        {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
      </div>
      <ArrowUpRight size={14} className="absolute top-2 right-2 text-slate-300 opacity-0 group-hover:opacity-100 transition"/>
    </Link>
  );
}

// Cor de cada estação no mini-mapa (igual à página do laboratório)
const STATION_DOT = {
  funcionando: 'bg-emerald-500',
  manutencao: 'bg-amber-500',
  defeito: 'bg-rose-500',
  sem_equipamento: 'bg-slate-300 dark:bg-slate-600',
};

// Card de laboratório no mapa do dashboard — quadrado, com mini-mapa de PCs
function LabMiniCard({ lab }) {
  const h = HEALTH[lab.health] || HEALTH.ok;
  const cells = lab.stations || [];
  // colunas do mini-mapa conforme a quantidade (mantém quadradinhos)
  const cols = cells.length <= 4 ? 4 : cells.length <= 9 ? 5 : cells.length <= 16 ? 6 : 8;
  return (
    <Link to={`/laboratorios/${lab._id}`}
      className="group relative flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden">
      <span className={`absolute top-0 left-0 right-0 h-1 ${h.cell}`}/>
      <div className="flex items-center gap-1.5 mt-1">
        <span className={`w-2 h-2 rounded-full ${h.cell} ${lab.health !== 'ok' ? 'animate-pulse' : ''}`}/>
        <p className="font-semibold text-[13px] text-slate-800 dark:text-white truncate">{lab.name}</p>
      </div>
      <p className="text-[10px] text-slate-500 truncate">{lab.school}</p>

      {/* mini-mapa dos PCs */}
      <div className="my-2 flex-1 flex items-center">
        {cells.length === 0 ? (
          <span className="text-[10px] text-slate-400 italic">sem estações</span>
        ) : (
          <div className="grid gap-1 w-full" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {cells.map((s, i) => (
              <span key={i} title={s.code}
                className={`aspect-square rounded-[3px] ${STATION_DOT[s.status] || STATION_DOT.sem_equipamento}`}/>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-[10px]">
        <span className="inline-flex items-center gap-0.5 text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>{lab.active}</span>
        <span className="inline-flex items-center gap-0.5 text-amber-600"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>{lab.maintenance}</span>
        <span className="inline-flex items-center gap-0.5 text-rose-600"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"/>{lab.defective}</span>
        <span className="ml-auto text-slate-400">{lab.total} PCs</span>
      </div>
    </Link>
  );
}

function Panel({ title, icon: Icon, children, count, accent = 'slate', to, className = '' }) {
  const accentText = {
    slate: 'text-slate-500', rose: 'text-rose-500', orange: 'text-orange-500',
  }[accent] || 'text-slate-500';
  return (
    <section className={`card p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          {Icon && <Icon size={17} className={accentText}/>} {title}
          {count !== undefined && (
            <span className="text-[11px] font-normal text-slate-400">({count})</span>
          )}
        </h3>
        {to && (
          <Link to={to} className="text-xs text-brand-600 hover:underline flex items-center gap-0.5">
            ver todas <ChevronRight size={12}/>
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Legend({ dot, label }) {
  return <span className="inline-flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded ${dot}`}/> {label}</span>;
}

function Empty({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-slate-400">
      <Icon size={28} className="mb-2 opacity-50"/>
      <p className="text-sm">{text}</p>
    </div>
  );
}

