import { useEffect, useState } from 'react';
import { BarChart3, FileDown, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import api from '../services/api';
import { PageLoader } from '../components/Loading';

export default function Reports() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tech, setTech] = useState([]);
  const [school, setSchool] = useState([]);
  const [eq, setEq] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = {};
    if (from) params.from = from; if (to) params.to = to;
    const [t, s, e] = await Promise.all([
      api.get('/reports/orders/by-technician', { params }),
      api.get('/reports/orders/by-school', { params }),
      api.get('/reports/equipment/most-maintained'),
    ]);
    setTech(t.data.data); setSchool(s.data.data); setEq(e.data.data);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function exportFile(type) {
    const params = new URLSearchParams({ ...(from && { from }), ...(to && { to }) }).toString();
    const url = `${api.defaults.baseURL}/reports/orders/${type}?${params}`;
    const token = localStorage.getItem('os_token');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(b => {
        const l = document.createElement('a');
        l.href = URL.createObjectURL(b);
        l.download = `relatorio-${Date.now()}.${type === 'excel' ? 'xlsx' : 'pdf'}`;
        l.click();
      });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 size={22}/> Relatórios
          </h1>
          <p className="text-sm text-slate-500">Filtre por período e exporte em Excel ou PDF.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportFile('excel')} className="btn-secondary"><FileDown size={16}/> Excel</button>
          <button onClick={() => exportFile('pdf')} className="btn-secondary"><FileText size={16}/> PDF</button>
        </div>
      </div>

      <div className="card p-4 grid md:grid-cols-3 gap-3 items-end">
        <div><label className="label">De</label><input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)}/></div>
        <div><label className="label">Até</label><input type="date" className="input" value={to} onChange={e => setTo(e.target.value)}/></div>
        <button onClick={load} className="btn-primary md:w-fit">Aplicar filtros</button>
      </div>

      {loading ? <PageLoader/> : (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="font-semibold mb-3">Ordens por técnico</h3>
            <div style={{ width:'100%', height:280 }}>
              <ResponsiveContainer>
                <BarChart data={tech}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b822"/>
                  <XAxis dataKey="technician" stroke="#94a3b8"/><YAxis stroke="#94a3b8"/>
                  <Tooltip contentStyle={{ background:'#0f172a', color:'#fff', border:'none', borderRadius:8 }}/>
                  <Legend/>
                  <Bar dataKey="total" fill="#3b82f6" radius={[6,6,0,0]}/>
                  <Bar dataKey="finalizadas" fill="#10b981" radius={[6,6,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold mb-3">Top escolas (mais O.S.)</h3>
            <ul className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
              {school.slice(0, 10).map((s, i) => (
                <li key={i} className="flex justify-between py-2">
                  <span className="truncate mr-3">{s.school || '-'}</span>
                  <span className="font-semibold text-brand-600">{s.total}</span>
                </li>
              ))}
              {school.length === 0 && <p className="text-slate-500 py-3">Sem dados</p>}
            </ul>
          </div>

          <div className="card p-5 lg:col-span-2">
            <h3 className="font-semibold mb-3">Equipamentos com mais manutenções</h3>
            <table className="table-modern">
              <thead><tr><th>Patrimônio</th><th>Tipo</th><th>Marca</th><th>Modelo</th><th>Manutenções</th></tr></thead>
              <tbody>
                {eq.map((e, i) => (
                  <tr key={i}>
                    <td>{e.patrimonio || '-'}</td><td>{e.type}</td><td>{e.brand}</td><td>{e.model}</td>
                    <td className="font-semibold text-brand-600">{e.total}</td>
                  </tr>
                ))}
                {eq.length === 0 && <tr><td colSpan={5} className="text-center py-5 text-slate-500">Sem dados</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
