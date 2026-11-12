import { useCallback, useEffect, useState } from 'react';
import { Wifi, FileDown, ExternalLink, RefreshCw, Search, X, Trash2, Inbox, ClipboardCheck, Send, Clock3, School, ShieldAlert, ChevronRight, SlidersHorizontal, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import InternetProviderDocument from './InternetProviderDocument';

const statusLabels = { recebida: 'Recebida', verificada: 'Verificada', encaminhada: 'Encaminhada' };
const typeLabels = { sem_internet: 'Sem internet', lenta_instavel: 'Lenta ou instável', local_especifico: 'Local específico', outro: 'Outro' };
const statusColor = { recebida: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300', verificada: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300', encaminhada: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' };
const date = value => value ? new Date(value).toLocaleString('pt-BR') : '—';
const errorMessage = e => e.response?.data?.message || 'Não foi possível concluir a operação.';
const cleanFilters = filters => Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
function duration(hours) {
  if (hours == null) return '—';
  if (hours < 1 / 60) return '< 1 min';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours.toFixed(1).replace('.', ',')} h`;
}

function PrivatePhotos({ requestId, count }) {
  const [urls, setUrls] = useState([]);
  const [failure, setFailure] = useState(false);
  useEffect(() => {
    let active = true;
    const created = [];
    setUrls([]); setFailure(false);
    Promise.all(Array.from({ length: count }, async (_, index) => {
      const { data } = await api.get(`/internet/requests/${requestId}/photos/${index}`, { responseType: 'blob' });
      if (!active) return null;
      const url = URL.createObjectURL(data); created.push(url); return url;
    })).then(result => { if (active) setUrls(result.filter(Boolean)); }).catch(() => { if (active) setFailure(true); });
    return () => { active = false; created.forEach(url => URL.revokeObjectURL(url)); };
  }, [requestId, count]);
  return <div className="space-y-2"><h3 className="font-semibold text-sm flex items-center gap-2"><Camera size={16}/> Fotos da etiqueta</h3>{failure && <p className="text-sm text-rose-600">Não foi possível carregar as fotos.</p>}{!failure && !urls.length && <p className="text-sm text-slate-500">Carregando fotos...</p>}<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{urls.map((url, i) => <a key={url} href={url} download={`etiqueta-${i + 1}`} className="block rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-sm text-brand-600 dark:text-blue-400"><img src={url} alt={`Foto da etiqueta ${i + 1}`} className="w-full h-36 object-contain rounded-lg bg-slate-100 dark:bg-slate-800"/><span className="block mt-2">Baixar foto {i + 1}</span></a>)}</div><p className="text-xs text-slate-500">As fotos são carregadas somente para usuários autenticados da equipe.</p></div>;
}

// A comparação e a confirmação são exclusivas do administrador.
function AddressApproval({ item }) {
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  async function review() {
    setLoading(true); setError(''); setProposal(null);
    try { const { data } = await api.get(`/internet/requests/${item._id}/address-proposal`); setProposal(data); }
    catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }
  async function confirm() {
    if (!proposal || loading || proposal.currentAddress === proposal.proposedAddress) return;
    setLoading(true); setError('');
    try {
      await api.post(`/internet/requests/${item._id}/address-confirmation`, { currentAddress: proposal.currentAddress, proposedAddress: proposal.proposedAddress });
      setConfirmed(true); setProposal(null); toast.success('Endereço atualizado no cadastro da escola.');
    } catch (e) { setError(errorMessage(e)); setProposal(null); }
    finally { setLoading(false); }
  }
  return <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-800 dark:bg-blue-950/30 space-y-3">
    <h3 className="font-semibold">Cadastro de endereço da escola · administrador</h3>
    <p>O envio não atualiza o cadastro automaticamente. Confira se o endereço informado é da escola, e não apenas do local do equipamento.</p>
    {confirmed ? <p role="status" className="font-semibold text-emerald-700 dark:text-emerald-300">Endereço confirmado e atualizado no cadastro.</p> : !proposal ? <button type="button" className="btn-secondary" disabled={loading} onClick={review}>{loading ? 'Consultando...' : 'Comparar e confirmar endereço'}</button> : <div className="space-y-3">
      <p><strong>Escola cadastrada:</strong> {proposal.schoolName} · INEP {proposal.inep}</p>
      <div className="rounded-lg bg-white p-3 dark:bg-slate-900"><p className="font-semibold">Endereço atual do cadastro</p><p className="mt-1 whitespace-pre-wrap break-words">{proposal.currentAddress || 'Não cadastrado'}</p></div>
      <div className="rounded-lg bg-white p-3 dark:bg-slate-900"><p className="font-semibold">Endereço informado nesta solicitação</p><p className="mt-1 whitespace-pre-wrap break-words">{proposal.proposedAddress}</p></div>
      {proposal.currentAddress === proposal.proposedAddress ? <p role="status">O endereço informado já é o mesmo do cadastro; nenhuma alteração é necessária.</p> : <p>Confirme com a escola, se necessário. Ao confirmar, o endereço atual do cadastro será substituído pelo endereço informado.</p>}
      <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" disabled={loading} onClick={() => { setProposal(null); setError(''); }}>Cancelar</button>{proposal.currentAddress !== proposal.proposedAddress && <button type="button" className="btn-primary" disabled={loading} onClick={confirm}>{loading ? 'Atualizando...' : 'Confirmar e atualizar cadastro'}</button>}</div>
    </div>}
    {error && <p role="alert" className="text-rose-700 dark:text-rose-300">{error} Consulte novamente antes de tentar confirmar.</p>}
  </div>;
}

export default function InternetRequests() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [filters, setFilters] = useState({ inep: '', status: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [summary, setSummary] = useState({ byStatus: [], byType: [], bySchool: [], averageHours: null });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [documentItem, setDocumentItem] = useState(null);
  const [notes, setNotes] = useState('');
  const [protocol, setProtocol] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const params = cleanFilters(filters);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const clean = cleanFilters(filters);
      const [list, totals] = await Promise.all([api.get('/internet/requests', { params: { ...clean, page } }), api.get('/internet/summary', { params: clean })]);
      if (page > list.data.pagination.totalPages) { setPage(list.data.pagination.totalPages); return; }
      setItems(list.data.items); setPagination(list.data.pagination); setSummary(totals.data);
    } catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }, [filters, page]);
  useEffect(() => { load(); }, [load]);
  const count = key => summary.byStatus.find(i => i._id === key)?.count || 0;
  function filter(key, value) { setPage(1); setFilters(f => ({ ...f, [key]: value })); }
  function clearFilters() { setPage(1); setFilters({ inep: '', status: '', from: '', to: '' }); }
  function open(item) { setSelected(item); setNotes(item.internalNotes || ''); setProtocol(item.providerProtocol || ''); setDeleting(false); setReason(''); }
  function close() { if (!saving) { setSelected(null); setDeleting(false); setReason(''); } }
  async function advance() {
    const next = selected.status === 'recebida' ? 'verificada' : 'encaminhada';
    if (next === 'encaminhada' && !window.confirm('Confirma que a solicitação já foi encaminhada ao provedor? O gestor verá esta atualização.')) return;
    setSaving(true);
    try { await api.patch(`/internet/requests/${selected._id}`, { status: next, internalNotes: notes, providerProtocol: protocol }); toast.success(next === 'verificada' ? 'Solicitação verificada.' : 'Encaminhamento registrado.'); setSelected(null); await load(); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setSaving(false); }
  }
  async function remove(e) {
    e.preventDefault();
    if (saving || reason.trim().length < 5) return;
    setSaving(true);
    try {
      await api.delete(`/internet/requests/${selected._id}`, { data: { reason: reason.trim() } });
      toast.success('Solicitação excluída do painel e dos relatórios.');
      setSelected(null); setDeleting(false); setReason(''); await load();
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setSaving(false); }
  }
  async function exportReport() {
    try {
      const response = await api.get('/internet/report.xlsx', { params, responseType: 'blob' });
      const url = URL.createObjectURL(response.data); const a = document.createElement('a'); a.href = url; a.download = 'internet-escolas.xlsx'; a.click(); URL.revokeObjectURL(url);
    } catch { toast.error('Não foi possível gerar o relatório.'); }
  }
  const metrics = [
    { label: 'Recebidas', value: count('recebida'), detail: 'Aguardam verificação', icon: Inbox, color: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300' },
    { label: 'Verificadas', value: count('verificada'), detail: 'Aguardam encaminhamento', icon: ClipboardCheck, color: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300' },
    { label: 'Encaminhadas', value: count('encaminhada'), detail: 'Enviadas ao provedor', icon: Send, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' },
    { label: 'Tempo médio', value: duration(summary.averageHours), detail: 'Do recebimento ao envio', icon: Clock3, color: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300' },
  ];
  return <div className="space-y-5 pb-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex gap-3 items-start"><span className="p-3 rounded-2xl bg-brand-600 text-white shadow-soft"><Wifi size={22}/></span><div><p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-blue-400">Atendimento às escolas</p><h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">Internet das Escolas</h1><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Acompanhe as solicitações até o encaminhamento ao provedor.</p></div></div>
      <div className="flex flex-wrap gap-2"><a className="btn-secondary" href="/internet-escolas" target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Portal público</a><button className="btn-primary" onClick={exportReport}><FileDown size={16}/> Exportar Excel</button></div>
    </div>
    <div className="flex gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 px-4 py-3 text-sm"><ShieldAlert size={19} className="shrink-0 mt-0.5"/><p><strong>Solicitações não verificadas.</strong> O INEP identifica a escola, mas não confirma a identidade de quem enviou. Confirme com a escola quando necessário.</p></div>
    <div className="flex items-end justify-between"><div><h2 className="font-semibold text-slate-900 dark:text-white">Visão geral</h2><p className="text-xs text-slate-500 mt-1">Situação atual das solicitações dentro dos filtros selecionados.</p></div></div>
    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-3">{metrics.map(({ label, value, detail, icon: Icon, color }) => <div key={label} className="card p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span><span className={`rounded-xl p-2.5 ${color}`}><Icon size={18}/></span></div><p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{loading ? '—' : value}</p><p className="text-xs text-slate-500 mt-1">{detail}</p></div>)}</div>
    <div className="card p-4 sm:p-5 space-y-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><SlidersHorizontal size={17} className="text-brand-600"/> Filtrar solicitações</div><button onClick={clearFilters} className="text-xs font-semibold text-brand-600 dark:text-blue-400 hover:underline">Limpar filtros</button></div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><label className="text-xs font-medium text-slate-500 dark:text-slate-400">INEP<input className="input mt-1.5" inputMode="numeric" value={filters.inep} onChange={e => filter('inep', e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Código da escola"/></label><label className="text-xs font-medium text-slate-500 dark:text-slate-400">Situação<select className="input mt-1.5" value={filters.status} onChange={e => filter('status', e.target.value)}><option value="">Todas as situações</option>{Object.entries(statusLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label><label className="text-xs font-medium text-slate-500 dark:text-slate-400">Recebida a partir de<input className="input mt-1.5" type="date" value={filters.from} onChange={e => filter('from', e.target.value)}/></label><label className="text-xs font-medium text-slate-500 dark:text-slate-400">Recebida até<input className="input mt-1.5" type="date" value={filters.to} onChange={e => filter('to', e.target.value)}/></label></div><p className="text-xs text-slate-500">Os filtros também são aplicados à visão geral e ao arquivo Excel.</p></div>
    <div className="grid lg:grid-cols-2 gap-3">
      <div className="card p-4 sm:p-5"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><School size={17} className="text-brand-600"/> Escolas com solicitações</div><p className="text-xs text-slate-500 mt-1">Até 20 escolas com mais pedidos nos filtros.</p>{summary.bySchool.length ? <div className="mt-4 flex flex-wrap gap-2">{summary.bySchool.map(x => <span key={x._id.inep} className="inline-flex gap-2 items-center rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-200"><span>{x._id.name} <span className="text-slate-500">· {x._id.inep}</span></span><strong className="rounded-md bg-white dark:bg-slate-700 px-1.5 py-0.5">{x.count}</strong></span>)}</div> : <p className="text-sm text-slate-500 mt-4">Nenhuma escola nos filtros selecionados.</p>}</div>
      <div className="card p-4 sm:p-5"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Search size={17} className="text-brand-600"/> Tipos de problema</div><p className="text-xs text-slate-500 mt-1">Distribuição das solicitações filtradas.</p>{summary.byType.length ? <div className="mt-4 flex flex-wrap gap-2">{summary.byType.map(x => <span key={x._id} className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-200">{typeLabels[x._id] || x._id} <strong className="ml-1">{x.count}</strong></span>)}</div> : <p className="text-sm text-slate-500 mt-4">Nenhum problema nos filtros selecionados.</p>}</div>
    </div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 p-3 text-sm">{error}</p>}
    <div className="card overflow-hidden"><div className="flex flex-wrap justify-between items-center gap-2 p-4 sm:p-5"><div><h2 className="font-semibold text-slate-900 dark:text-white">Solicitações <span className="ml-1 text-xs rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1">{pagination.total}</span></h2><p className="text-xs text-slate-500 mt-1">Selecione uma solicitação para consultar e atualizar.</p></div><button className="btn-secondary !py-1.5" onClick={load} disabled={loading}><RefreshCw size={15}/> Atualizar</button></div>{loading ? <p className="p-5 text-slate-500">Carregando...</p> : items.length === 0 ? <div className="p-8 text-center text-slate-500"><Inbox size={28} className="mx-auto mb-2 text-slate-400"/><p>Nenhuma solicitação encontrada.</p><p className="text-xs mt-1">Tente alterar os filtros ou aguarde novos pedidos.</p></div> : <div className="overflow-x-auto"><table className="table-modern"><thead><tr><th>Recebida</th><th>Escola / INEP</th><th>Problema</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{items.map(item => <tr key={item._id}><td className="whitespace-nowrap">{date(item.createdAt)}</td><td><strong>{item.schoolName}</strong><div className="text-xs text-slate-500 mt-0.5">INEP {item.inep}</div></td><td>{typeLabels[item.issueType]}</td><td><span className={`badge ${statusColor[item.status]}`}>{statusLabels[item.status]}</span></td><td><div className="flex items-center gap-1"><button className="btn-secondary !px-3 !py-1.5 whitespace-nowrap" onClick={() => open(item)}>Detalhes <ChevronRight size={14}/></button><button className="btn-ghost !px-3 !py-1.5 whitespace-nowrap text-brand-600 dark:text-blue-400" onClick={() => setDocumentItem(item)}>Documento PDF</button>{isAdmin && <button className="btn-ghost !p-2 text-rose-600 dark:text-rose-400" title="Excluir solicitação" aria-label={`Excluir solicitação de ${item.schoolName}`} onClick={() => { open(item); setDeleting(true); }}><Trash2 size={16}/></button>}</div></td></tr>)}</tbody></table></div>}<div className="flex justify-between items-center gap-2 p-4 text-sm text-slate-500"><span>Página {pagination.page} de {pagination.totalPages}</span><div className="flex gap-2"><button className="btn-secondary !py-1" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Anterior</button><button className="btn-secondary !py-1" disabled={page >= pagination.totalPages || loading} onClick={() => setPage(p => p + 1)}>Próxima</button></div></div></div>
    {selected && <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4" onClick={close}><div role="dialog" aria-modal="true" aria-labelledby="internet-detail-title" className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4" onClick={e => e.stopPropagation()}><div className="flex justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-blue-400">Internet das Escolas</p><h2 id="internet-detail-title" className="text-xl font-bold text-slate-900 dark:text-white mt-1">{deleting ? 'Excluir solicitação?' : 'Detalhes da solicitação'}</h2><p className="text-sm text-slate-500 mt-1">{selected.schoolName} · INEP {selected.inep}</p></div><button className="btn-ghost !p-1 self-start" onClick={close} aria-label="Fechar" disabled={saving}><X size={20}/></button></div>
      {deleting ? <form onSubmit={remove} className="space-y-4"><div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 p-4 text-sm text-rose-800 dark:text-rose-300"><strong>Atenção:</strong> a solicitação deixará de aparecer no painel e nos relatórios, e o link público de acompanhamento deixará de funcionar. O registro será mantido no banco para auditoria.</div><div><label className="label" htmlFor="deletion-reason">Motivo da exclusão</label><textarea id="deletion-reason" className="input" rows={3} minLength={5} maxLength={300} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex.: solicitação duplicada" required/><p className="text-xs text-slate-500 mt-1">Informe pelo menos 5 caracteres. O motivo e o responsável serão registrados.</p></div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" disabled={saving} onClick={() => setDeleting(false)}>Cancelar</button><button className="btn-danger" disabled={saving || reason.trim().length < 5}><Trash2 size={16}/> {saving ? 'Excluindo...' : 'Confirmar exclusão'}</button></div></form> : <><div className="text-sm grid sm:grid-cols-2 gap-3 text-slate-700 dark:text-slate-200"><p><strong>Situação:</strong> <span className={`badge ${statusColor[selected.status]}`}>{statusLabels[selected.status]}</span></p><p><strong>Recebida:</strong> {date(selected.createdAt)}</p><p><strong>Contato:</strong> {selected.contactName}</p><p><strong>Telefone:</strong> {selected.phone}</p><p><strong>Problema:</strong> {typeLabels[selected.issueType]}</p><p><strong>Desde:</strong> {selected.since}</p><p><strong>Verificada:</strong> {date(selected.verifiedAt)} {selected.verifiedBy?.name && `por ${selected.verifiedBy.name}`}</p><p><strong>Encaminhada:</strong> {date(selected.forwardedAt)} {selected.forwardedBy?.name && `por ${selected.forwardedBy.name}`}</p></div><div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-sm whitespace-pre-wrap break-words"><strong>Descrição da escola:</strong><br/>{selected.description}</div>{selected.installation?.siteName && <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-sm space-y-2"><h3 className="font-semibold">Local e equipamentos</h3><p><strong>Local:</strong> {selected.installation.siteName}</p><p className="whitespace-pre-wrap break-words"><strong>Endereço:</strong> {selected.installation.address}</p><p><strong>Quantidade de aparelhos:</strong> {selected.installation.equipmentCount === 'unknown' ? 'Não sei informar' : selected.installation.equipmentCount === 'other' ? selected.installation.equipmentCountOther || 'Outra quantidade' : selected.installation.equipmentCount}</p><p><strong>Etiqueta:</strong> {({ '1': 'Encontrada em 1 aparelho', '2': 'Encontrada em 2 aparelhos', not_found: 'Não encontrada', cannot_check: 'Não conseguiu verificar' })[selected.installation.gponStatus] || 'Não informada'}</p>{(selected.installation.identifiers || []).map((x, index) => <p key={index} className="break-words"><strong>SN GPON {index + 1}:</strong> {x.number}{x.location ? ` · ${x.location}` : ''}</p>)}</div>}{isAdmin && selected.installation?.address?.trim() && <AddressApproval key={selected._id} item={selected}/>}{selected.photoCount > 0 && <PrivatePhotos requestId={selected._id} count={selected.photoCount}/>}<div><label className="label" htmlFor="internet-notes">Observações internas</label><textarea id="internet-notes" className="input" rows={3} maxLength={2000} value={notes} disabled={selected.status === 'encaminhada'} onChange={e => setNotes(e.target.value)}/></div>{selected.status !== 'recebida' && <div><label className="label" htmlFor="provider-protocol">Protocolo do provedor (opcional)</label><input id="provider-protocol" className="input" maxLength={150} value={protocol} disabled={selected.status === 'encaminhada'} onChange={e => setProtocol(e.target.value)}/></div>}<p className="text-xs text-slate-500">Observações e protocolo são internos e não aparecem no acompanhamento público. O registro é concluído ao encaminhar.</p><div className="flex flex-wrap justify-between gap-2"><div>{isAdmin && <button className="btn-ghost text-rose-600 dark:text-rose-400" disabled={saving} onClick={() => setDeleting(true)}><Trash2 size={16}/> Excluir</button>}</div><div className="flex flex-wrap justify-end gap-2"><button className="btn-secondary" disabled={saving} onClick={() => { setDocumentItem(selected); setSelected(null); }}>Documento PDF</button><button className="btn-secondary" disabled={saving} onClick={close}>Fechar</button>{selected.status !== 'encaminhada' && <button className="btn-primary" disabled={saving} onClick={advance}>{saving ? 'Salvando...' : selected.status === 'recebida' ? 'Marcar como verificada' : 'Registrar encaminhamento'}</button>}</div></div></>}
    </div></div>}
    {documentItem && <InternetProviderDocument item={documentItem} onClose={() => setDocumentItem(null)} />}
  </div>;
}
