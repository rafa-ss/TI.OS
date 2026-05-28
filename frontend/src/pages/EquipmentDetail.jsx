import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, QrCode, ArrowRightLeft, Download, FileText, Wrench } from 'lucide-react';
import api from '../services/api';
import { PageLoader } from '../components/Loading';
import {
  EQUIPMENT_TYPE_LABEL, EQUIPMENT_STATUS_LABEL, EQUIPMENT_STATUS_COLOR, formatDate, formatDateOnly
} from '../utils/format';

const MOV_LABEL = {
  entrega: 'Entrega',
  devolucao: 'Devolução',
  transferencia: 'Transferência',
  manutencao: 'Manutenção',
  descarte: 'Descarte',
  outro: 'Outro',
};

export default function EquipmentDetail() {
  const { id } = useParams();
  const [eq, setEq] = useState(null);
  const [qr, setQr] = useState(null);

  const load = useCallback(async () => {
    const { data } = await api.get(`/equipment/${id}`);
    setEq(data.equipment);
    api.get(`/equipment/${id}/qrcode`, { params: { baseUrl: window.location.origin } })
      .then(r => setQr(r.data.dataUrl));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function downloadTerm(movId) {
    const token = localStorage.getItem('os_token');
    const res = await fetch(`${api.defaults.baseURL}/equipment/${id}/movements/${movId}/term`,
      { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  }

  if (!eq) return <PageLoader/>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/equipamentos" className="btn-secondary p-2"><ArrowLeft size={16}/></Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{eq.patrimonio}</h1>
          <p className="text-sm text-slate-500">{EQUIPMENT_TYPE_LABEL[eq.type]} · {[eq.brand, eq.model].filter(Boolean).join(' ')}</p>
        </div>
        <span className={`badge ${EQUIPMENT_STATUS_COLOR[eq.status]}`}>{EQUIPMENT_STATUS_LABEL[eq.status]}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5 grid md:grid-cols-2 gap-4 text-sm">
            <Info label="Patrimônio" value={eq.patrimonio}/>
            <Info label="Tipo" value={EQUIPMENT_TYPE_LABEL[eq.type]}/>
            <Info label="Marca / Modelo" value={[eq.brand, eq.model].filter(Boolean).join(' ') || '-'}/>
            <Info label="Nº de série" value={eq.serialNumber}/>
            <Info label="Local atual" value={eq.school?.name || eq.location || '-'}/>
            <Info label="INEP da escola" value={eq.school?.inep || '-'}/>
            <Info label="Data de aquisição" value={formatDateOnly(eq.acquisitionDate)}/>
            <Info label="Nota fiscal" value={eq.invoice}/>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <ArrowRightLeft size={16}/>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Histórico de movimentações</h3>
            </div>
            {eq.movements.length === 0 ? (
              <p className="text-sm text-slate-500 p-6 text-center">Sem movimentações.</p>
            ) : (
              <table className="table-modern">
                <thead><tr><th>Data</th><th>Tipo</th><th>De</th><th>Para</th><th>Recebedor</th><th>Doc</th><th></th></tr></thead>
                <tbody>
                  {eq.movements.slice().reverse().map(m => (
                    <tr key={m._id}>
                      <td className="text-xs">{formatDate(m.date)}</td>
                      <td><span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{MOV_LABEL[m.type]}</span></td>
                      <td className="text-xs max-w-[150px] truncate">{m.fromSchool?.name || m.fromLocation || '-'}</td>
                      <td className="text-xs max-w-[150px] truncate">{m.toSchool?.name || m.toLocation || '-'}</td>
                      <td className="text-xs">{m.receiverName || '-'}</td>
                      <td className="text-xs font-mono">{m.deliveryDocNumber}</td>
                      <td><button onClick={() => downloadTerm(m._id)} className="btn-ghost p-1.5" title="Baixar termo PDF"><FileText size={16}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <Wrench size={16}/>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Histórico de manutenções</h3>
            </div>
            {eq.maintenanceHistory.length === 0 ? (
              <p className="text-sm text-slate-500 p-6 text-center">Sem manutenções registradas.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {eq.maintenanceHistory.slice().reverse().map((m, i) => (
                  <li key={i} className="p-4">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{formatDate(m.date)}</span>
                      <span>{m.technician?.name || '-'}</span>
                    </div>
                    <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">{m.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-700 dark:text-slate-200 mb-3">
              <QrCode size={18}/>
              <h3 className="font-semibold">Etiqueta QR</h3>
            </div>
            {qr ? (
              <>
                <img src={qr} alt="QR" className="mx-auto w-48 h-48"/>
                <p className="text-xs text-slate-500 mt-2">Escaneie para abrir esta página</p>
                <a href={qr} download={`qr-${eq.patrimonio}.png`} className="btn-primary mt-4 w-full">
                  <Download size={16}/> Baixar PNG
                </a>
              </>
            ) : <p className="text-slate-500 py-12">Gerando...</p>}
          </div>

          {eq.notes && (
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Observações</p>
              <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-200">{eq.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
      <p className="text-slate-800 dark:text-slate-200">{value || '-'}</p>
    </div>
  );
}