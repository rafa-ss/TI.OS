import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, MessageSquare, Send, Paperclip, Trash2, History,
  Pencil, Play, CheckCircle2, Lock, Printer, FileText, Eye, ExternalLink, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { PageLoader } from '../components/Loading';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { formatDate, ROLE_LABEL, SERVICE_TYPE_LABEL, EQUIPMENT_TYPE_LABEL, SERVICE_LOCATION_LABEL, SERVICE_LOCATION_COLOR, PREVENTIVE_ITEM_LABEL, CORRECTIVE_ITEM_LABEL } from '../utils/format';
import OrderFormModal from './OrderFormModal';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

const STATUSES_AFTER_START = [
  { v: 'em_andamento', l: 'Em andamento' },
  { v: 'aguardando_peca', l: 'Aguardando peça' },
  { v: 'finalizada', l: 'Finalizada' },
  { v: 'entregue', l: 'Entregue' },
  { v: 'cancelada', l: 'Cancelada' },
];

function resolveAttachmentUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return new URL(url, api.defaults.baseURL).toString();
}

function isPdfAttachment(att) {
  return att?.mimeType === 'application/pdf' || /\.pdf($|\?)/i.test(att?.name || att?.url || '');
}

function isImageAttachment(att) {
  return (att?.mimeType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)($|\?)/i.test(att?.name || att?.url || '');
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]);
  const [editing, setEditing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const { user, hasRole } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.order);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => () => {
    if (previewAttachment?.previewUrl) URL.revokeObjectURL(previewAttachment.previewUrl);
  }, [previewAttachment]);

  // ---------- regras de permissão (espelham o backend) ----------
  const isAdmin = hasRole('admin');
  const isAttendant = hasRole('atendente');
  const isTechOrAdmin = hasRole('admin', 'tecnico');
  const isCreator = order && order.createdBy?._id === user?._id;
  const isStarter = order && order.technician?._id === user?._id;
  const isFinalized = order && ['finalizada', 'entregue'].includes(order.status);

  // Editar:
  //  - se ainda está aberta (sem técnico): o criador OU admin
  //  - se já iniciou: só quem iniciou OU admin
  const canEdit = order && (
    isAdmin ||
    (!order.technician && isCreator) ||
    (order.technician && isStarter)
  );

  // Iniciar: só técnico/admin, e a O.S. precisa estar aberta
  const canStart = order?.status === 'aberta' && isTechOrAdmin;

  // Mudar status / finalizar: só quem iniciou OU admin
  const canChangeStatus = order && order.status !== 'aberta' && (isAdmin || isStarter);

  // Atendente pode somente registrar a entrega quando a O.S. já foi finalizada
  const canRegisterDelivery = order?.status === 'finalizada' && isAttendant;

  // Imprimir/baixar PDF: qualquer usuário, só quando finalizada
  const canPrint = isFinalized;

  // Excluir: admin sempre; autor apenas se ainda estiver aberta (sem técnico)
  const canDelete = order && (isAdmin || (isCreator && order.status === 'aberta'));

  // ---------- ações ----------
  async function removeOrder() {
    if (!confirm(`Excluir a O.S. ${order.number}? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/orders/${order._id}`);
      toast.success('O.S. excluída');
      navigate('/ordens');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao excluir');
    }
  }

  async function startOrder() {
    try {
      await api.post(`/orders/${id}/start`);
      toast.success('Atendimento iniciado — você é o técnico responsável');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao iniciar');
    }
  }

  async function changeStatus(status) {
    if (status === 'finalizada') {
      setFinalizing(true);
      return;
    }
    if (status === 'entregue' && isAttendant) {
      const ok = confirm('Confirmar que a entrega desta O.S. foi realizada?');
      if (!ok) return;
    }
    try {
      await api.patch(`/orders/${id}/status`, { status });
      toast.success(status === 'entregue' ? 'Entrega registrada com sucesso' : 'Status atualizado');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro');
    }
  }

  async function downloadPdf(forPrint = false) {
    try {
      const token = localStorage.getItem('os_token');
      const res = await fetch(
        `${api.defaults.baseURL}/orders/${id}/print`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Falha ao gerar PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (forPrint) {
        // Abre em nova aba e dispara o print
        const w = window.open(url, '_blank');
        if (w) w.onload = () => setTimeout(() => w.print(), 400);
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `OS-${order.number.replace(/[\/\\]/g, '-')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function sendComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    await api.post(`/orders/${id}/comments`, { text: comment, internal: true });
    setComment('');
    load();
  }

  async function uploadFiles() {
    if (!files.length) return;
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    await api.post(`/orders/${id}/attachments`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    setFiles([]);
    toast.success('Anexos enviados');
    load();
  }

  async function removeAttachment(attId) {
    if (!confirm('Remover anexo?')) return;
    await api.delete(`/orders/${id}/attachments/${attId}`);
    load();
  }

  function attachmentEndpoint(att, { download = false } = {}) {
    const attId = att?._id || att?.id;
    if (!attId) return null;
    const qs = download ? '?download=1' : '';
    return `/orders/${id}/attachments/${attId}/view${qs}`;
  }

  async function parseBlobError(err) {
    const blob = err?.response?.data;
    if (blob instanceof Blob) {
      try {
        const text = await blob.text();
        const parsed = JSON.parse(text);
        const message = parsed?.message || parsed?.error;
        if (message) return message;
      } catch {}
    }
    return err?.response?.data?.message || err?.message || 'Erro ao carregar anexo';
  }

  async function fetchAttachmentBlob(att, options = {}) {
    const endpoint = attachmentEndpoint(att, options);

    if (endpoint) {
      try {
        const { data } = await api.get(endpoint, { responseType: 'blob' });
        return data;
      } catch (err) {
        const status = err?.response?.status;
        if (status && status !== 404) {
          throw new Error(await parseBlobError(err));
        }
      }
    }

    const directUrl = resolveAttachmentUrl(att?.url);
    if (directUrl) {
      try {
        const res = await fetch(directUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.blob();
      } catch (err) {
        throw new Error('Anexo não encontrado no servidor. Reenvie o arquivo para esta O.S.');
      }
    }

    throw new Error('Anexo sem identificador ou URL válida');
  }

  async function openAttachmentPreview(att) {
    if (!isPdfAttachment(att) && !isImageAttachment(att)) {
      return downloadAttachment(att, { openAfterDownload: true });
    }

    try {
      const blob = await fetchAttachmentBlob(att);
      const previewUrl = URL.createObjectURL(blob);

      setPreviewAttachment((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return {
          ...att,
          previewUrl,
        };
      });
    } catch (err) {
      toast.error(err.message || 'Erro ao abrir anexo');
    }
  }

  function closeAttachmentPreview() {
    setPreviewAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }

  async function downloadAttachment(att, { openAfterDownload = false } = {}) {
    try {
      const blob = await fetchAttachmentBlob(att, { download: true });
      const fileUrl = URL.createObjectURL(blob);

      if (openAfterDownload) {
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
        return;
      }

      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = att.name || 'anexo';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(fileUrl), 10_000);
    } catch (err) {
      toast.error(err.message || 'Erro ao baixar anexo');
    }
  }

  if (loading || !order) return <PageLoader />;

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Link to="/ordens" className="btn-secondary p-2"><ArrowLeft size={16}/></Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{order.number}</h1>
            <p className="text-xs text-slate-500">
              Aberta em {formatDate(order.openedAt)}
              {order.createdBy && ` por ${order.createdBy.name}`}
            </p>
          </div>
          <StatusBadge status={order.status} />
          <PriorityBadge priority={order.priority} />
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* IMPRIMIR / BAIXAR PDF — só quando finalizada */}
          {canPrint && (
            <>
              <button onClick={() => downloadPdf(false)} className="btn-secondary" title="Baixar PDF">
                <FileText size={16}/> Baixar PDF
              </button>
              <button onClick={() => downloadPdf(true)} className="btn-secondary" title="Imprimir">
                <Printer size={16}/> Imprimir
              </button>
            </>
          )}

          {/* INICIAR — só tec/admin com status aberta */}
          {canStart && (
            <button onClick={startOrder} className="btn-primary">
              <Play size={16}/> Iniciar atendimento
            </button>
          )}

          {/* Mudança de status — só quem iniciou ou admin */}
          {canChangeStatus && (
            <select
              className="input !w-auto"
              value={order.status}
              onChange={(e) => changeStatus(e.target.value)}
            >
              {STATUSES_AFTER_START.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          )}

          {/* ENTREGA — atendente só pode concluir a entrega após finalização técnica */}
          {canRegisterDelivery && (
            <button onClick={() => changeStatus('entregue')} className="btn-primary">
              <CheckCircle2 size={16}/> Registrar entrega
            </button>
          )}

          {/* EDITAR */}
          {canEdit ? (
            <button onClick={() => setEditing(true)} className="btn-secondary">
              <Pencil size={16}/> Editar
            </button>
          ) : (
            <button disabled
              title={order.technician
                ? 'Apenas o técnico que iniciou pode editar'
                : 'Apenas o autor pode editar antes do início'}
              className="btn-secondary opacity-50 cursor-not-allowed">
              <Lock size={16}/> Bloqueado
            </button>
          )}

          {/* EXCLUIR */}
          {canDelete && (
            <button onClick={removeOrder} className="btn-danger" title="Excluir O.S.">
              <Trash2 size={16}/> Excluir
            </button>
          )}
        </div>
      </div>

      {/* Aviso de status aberto */}
      {order.status === 'aberta' && (
        <div className="card p-4 border-l-4 border-l-sky-500 bg-sky-50 dark:bg-sky-900/20">
          <p className="text-sm text-sky-800 dark:text-sky-200">
            ⏳ Esta O.S. está <b>aguardando atendimento</b>.
            {isTechOrAdmin
              ? ' Clique em "Iniciar atendimento" para assumir.'
              : ' Aguarde um técnico ou administrador iniciar.'}
          </p>
        </div>
      )}

      {order.status === 'finalizada' && (
        <div className="card p-4 border-l-4 border-l-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 space-y-1">
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            ✅ Esta O.S. foi <b>finalizada</b>. Você pode baixar ou imprimir o PDF para arquivo.
          </p>
          {canRegisterDelivery && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Como atendente, agora você já pode clicar em <b>Registrar entrega</b>.
            </p>
          )}
        </div>
      )}

      {order.status === 'entregue' && (
        <div className="card p-4 border-l-4 border-l-teal-500 bg-teal-50 dark:bg-teal-900/20">
          <p className="text-sm text-teal-800 dark:text-teal-200">
            📦 Esta O.S. já foi <b>entregue</b> ao solicitante.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5 grid md:grid-cols-2 gap-4 text-sm">
            <Info label="Solicitante" value={order.requesterName} />
            <Info label="Contato" value={[order.requesterPhone, order.requesterEmail].filter(Boolean).join(' • ') || '-'} />
            <Info label="Escola" value={order.school?.name || '-'} />
            <Info label="INEP" value={order.inep || order.school?.inep || '-'} />
            <Info
              label={(order.equipmentType || '').includes(',') ? 'Equipamentos' : 'Equipamento'}
              value={
                (order.equipmentType || '')
                  .split(',').map(t => t.trim()).filter(Boolean)
                  .map(t => EQUIPMENT_TYPE_LABEL[t] || t)
                  .join(', ') || '-'
              }
            />
            <Info label="Tipo de serviço" value={SERVICE_TYPE_LABEL[order.serviceType] || order.serviceType || '-'} />
            <Info
              label="Local do atendimento"
              value={
                <span className={`badge ${SERVICE_LOCATION_COLOR[order.serviceLocation] || ''}`}>
                  {order.serviceLocation === 'ctec' ? '🏢 ' : '🚗 '}
                  {SERVICE_LOCATION_LABEL[order.serviceLocation] || 'não definido'}
                </span>
              }
            />
            <Info label="Técnico responsável" value={order.technician?.name || <span className="text-slate-400 italic">aguardando início</span>} />
            <Info
              label="Técnico(s) auxiliar(es)"
              value={
                (order.helpers && order.helpers.length > 0)
                  ? order.helpers.map(h => h.name).join(', ')
                  : <span className="text-slate-400 italic">nenhum</span>
              }
            />
            <Info label="Conclusão" value={formatDate(order.closedAt)} />
          </div>

          <div className="card p-5 space-y-4 text-sm">
            <Block title="Problema relatado" text={order.problemReported} />
            {order.diagnosis && <Block title="Diagnóstico técnico" text={order.diagnosis} />}
            {order.serviceDone && <Block title="Serviço realizado" text={order.serviceDone} />}
          </div>

          {/* Seção de Laboratório (OS de manutenção de laboratório) */}
          {order.laboratory && (
            <div className="card p-5 space-y-3 text-sm">
              <h3 className="font-semibold flex items-center gap-2">🧪 Laboratório</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <Link to={`/laboratorios/${order.laboratory._id || order.laboratory}`}
                  className="text-brand-600 hover:underline font-medium">
                  {order.laboratory.name || 'Ver laboratório'}
                </Link>
                {(order.stations && order.stations.length > 0) && (
                  <div className="flex flex-wrap gap-1">
                    {order.stations.map(s => (
                      <span key={s.code} className="inline-flex px-2 py-0.5 rounded font-mono text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                        {s.code}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {order.preventiveChecklist?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Manutenção preventiva realizada:</p>
                  <ul className="grid sm:grid-cols-2 gap-1">
                    {order.preventiveChecklist.map(i => (
                      <li key={i} className="text-xs flex items-center gap-1 text-emerald-700 dark:text-emerald-300">✓ {PREVENTIVE_ITEM_LABEL[i] || i}</li>
                    ))}
                  </ul>
                </div>
              )}
              {order.correctiveChecklist?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Manutenção corretiva realizada:</p>
                  <ul className="grid sm:grid-cols-2 gap-1">
                    {order.correctiveChecklist.map(i => (
                      <li key={i} className="text-xs flex items-center gap-1 text-amber-700 dark:text-amber-300">✓ {CORRECTIVE_ITEM_LABEL[i] || i}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="card p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Paperclip size={16}/> Anexos</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="text-sm"/>
              <button onClick={uploadFiles} disabled={!files.length} className="btn-primary"><Upload size={14}/> Enviar</button>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {order.attachments.length === 0 && <li className="py-3 text-sm text-slate-500">Nenhum anexo</li>}
              {order.attachments.map(a => {
                const canPreview = isPdfAttachment(a) || isImageAttachment(a);
                return (
                  <li key={a._id} className="py-3 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => openAttachmentPreview(a)}
                        className="text-left text-brand-600 hover:underline truncate max-w-full font-medium"
                        title={canPreview ? 'Visualizar anexo' : 'Abrir anexo'}
                      >
                        {a.name}
                      </button>
                      <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-2">
                        <span>{a.mimeType || 'arquivo'}</span>
                        {a.size ? <span>• {(a.size / 1024 / 1024).toFixed(2)} MB</span> : null}
                        {canPreview ? <span>• visualização disponível</span> : <span>• abrirá em nova aba</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openAttachmentPreview(a)}
                        className="btn-ghost p-1.5 text-brand-600"
                        title={canPreview ? 'Visualizar' : 'Abrir'}
                      >
                        {canPreview ? <Eye size={15}/> : <ExternalLink size={15}/>} 
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadAttachment(a)}
                        className="btn-ghost p-1.5 text-slate-600 dark:text-slate-300"
                        title="Baixar anexo"
                      >
                        <Download size={15}/>
                      </button>
                      <button onClick={() => removeAttachment(a._id)} className="btn-ghost text-rose-500 p-1.5" title="Remover anexo"><Trash2 size={14}/></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><MessageSquare size={16}/> Comentários internos</h3>
            <form onSubmit={sendComment} className="flex gap-2 mb-4">
              <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Adicionar comentário..." className="input" />
              <button className="btn-primary"><Send size={16}/></button>
            </form>
            <ul className="space-y-3">
              {order.comments.length === 0 && <li className="text-sm text-slate-500">Sem comentários</li>}
              {order.comments.map(c => (
                <li key={c._id} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {c.author?.name || 'Usuário'} <span className="text-[10px] ml-1">{ROLE_LABEL[c.author?.role] || ''}</span>
                    </span>
                    <span>{formatDate(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{c.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><History size={16}/> Histórico</h3>
            <ol className="relative border-l border-slate-200 dark:border-slate-800 ml-2 space-y-4">
              {order.history.slice().reverse().map((h, i) => (
                <li key={i} className="ml-4">
                  <div className="absolute -left-1.5 w-3 h-3 bg-brand-500 rounded-full mt-1.5" />
                  <p className="text-xs text-slate-500">{formatDate(h.createdAt)}</p>
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    <span className="font-semibold">{h.user?.name || 'Sistema'}</span> · {h.action}
                    {h.field ? ` (${h.field})` : ''}
                  </p>
                  {(h.from !== undefined || h.to !== undefined) && (
                    <p className="text-xs text-slate-500">
                      {String(h.from ?? '—')} → {String(h.to ?? '—')}
                    </p>
                  )}
                  {h.note && <p className="text-xs text-slate-500">{h.note}</p>}
                </li>
              ))}
              {order.history.length === 0 && <p className="text-sm text-slate-500">Sem histórico</p>}
            </ol>
          </div>
        </div>
      </div>

      <AttachmentPreviewModal
        file={previewAttachment}
        onClose={closeAttachmentPreview}
        onDownload={downloadAttachment}
      />

      <OrderFormModal
        open={editing}
        order={order}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); load(); }}
      />

      <FinalizeModal
        open={finalizing}
        order={order}
        onClose={() => setFinalizing(false)}
        onDone={() => { setFinalizing(false); load(); }}
      />
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

function Block({ title, text }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">{title}</p>
      <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">{text || <span className="text-slate-400 italic">não informado</span>}</p>
    </div>
  );
}

function AttachmentPreviewModal({ file, onClose, onDownload }) {
  if (!file) return null;

  const isPdf = isPdfAttachment(file);
  const isImage = isImageAttachment(file);
  const src = file.previewUrl || '';

  return (
    <Modal
      open={!!file}
      onClose={onClose}
      size="xl"
      title={`Visualizar anexo · ${file.name || 'arquivo'}`}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Fechar</button>
          <button
            onClick={() => src && window.open(src, '_blank', 'noopener,noreferrer')}
            className="btn-secondary"
          >
            <ExternalLink size={16}/> Abrir em nova aba
          </button>
          <button onClick={() => onDownload?.(file)} className="btn-primary">
            <Download size={16}/> Baixar
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-xs text-slate-500 flex flex-wrap gap-3">
          <span><b>Arquivo:</b> {file.name}</span>
          {file.mimeType ? <span><b>Tipo:</b> {file.mimeType}</span> : null}
        </div>

        {isPdf && (
          <iframe
            src={src}
            title={file.name || 'PDF'}
            className="w-full h-[70vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
          />
        )}

        {isImage && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 flex justify-center">
            <img
              src={src}
              alt={file.name || 'Imagem anexada'}
              className="max-h-[70vh] w-auto rounded-lg shadow"
            />
          </div>
        )}

        {!isPdf && !isImage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200 p-4 text-sm">
            Este tipo de arquivo não possui visualização embutida. Use os botões acima para abrir ou baixar.
          </div>
        )}
      </div>
    </Modal>
  );
}

function FinalizeModal({ open, order, onClose, onDone }) {
  const [diagnosis, setDiagnosis] = useState('');
  const [serviceDone, setServiceDone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && order) {
      setDiagnosis(order.diagnosis || '');
      setServiceDone(order.serviceDone || '');
    }
  }, [open, order]);

  async function submit() {
    if (!diagnosis.trim()) {
      return toast.error('O diagnóstico técnico é obrigatório para finalizar');
    }
    setSaving(true);
    try {
      if (serviceDone !== (order.serviceDone || '')) {
        await api.put(`/orders/${order._id}`, { serviceDone });
      }
      await api.patch(`/orders/${order._id}/status`, {
        status: 'finalizada', diagnosis,
      });
      toast.success('O.S. finalizada com sucesso');
      onDone?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao finalizar');
    } finally { setSaving(false); }
  }

  return (
    <Modal
      open={open} onClose={onClose} size="md"
      title="Finalizar Ordem de Serviço"
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={submit} disabled={saving} className="btn-primary">
          <CheckCircle2 size={16}/> {saving ? 'Finalizando...' : 'Confirmar finalização'}
        </button>
      </>}
    >
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm">
          <p className="font-semibold text-emerald-800 dark:text-emerald-200">✅ Antes de finalizar, registre o diagnóstico técnico</p>
          <p className="text-emerald-700 dark:text-emerald-300 text-xs mt-1">Esse campo é obrigatório e ficará no histórico da O.S.</p>
        </div>
        <div>
          <label className="label">Diagnóstico técnico * <span className="text-rose-500">(obrigatório)</span></label>
          <textarea required rows={4} className="input"
            placeholder="Descreva o diagnóstico técnico encontrado..."
            value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)}/>
        </div>
        <div>
          <label className="label">Serviço realizado (opcional)</label>
          <textarea rows={3} className="input"
            placeholder="Descreva o que foi feito no atendimento..."
            value={serviceDone} onChange={(e) => setServiceDone(e.target.value)}/>
        </div>
      </div>
    </Modal>
  );
}
