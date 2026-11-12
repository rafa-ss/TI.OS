import { useEffect, useRef, useState } from 'react';
import { FileText, FileDown, X, Eye, ShieldAlert } from 'lucide-react';
import api from '../services/api';

async function errorMessage(error) {
  const data = error.response?.data;
  if (data instanceof Blob) { try { return JSON.parse(await data.text()).message || 'Não foi possível gerar o documento.'; } catch { return 'Não foi possível gerar o documento.'; } }
  return data?.message || 'Não foi possível conectar ao sistema.';
}
function PhotoOption({ id, index, selected, onChange, disabled }) {
  const [url, setUrl] = useState(''); const [error, setError] = useState(false);
  useEffect(() => {
    let live = true, objectUrl = '';
    api.get(`/internet/requests/${id}/photos/${index}`, { responseType: 'blob' }).then(({ data }) => {
      if (!live) return; objectUrl = URL.createObjectURL(data); setUrl(objectUrl);
    }).catch(() => { if (live) setError(true); });
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, index]);
  return <label className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2 text-sm block"><span className="flex gap-2 items-center"><input type="checkbox" checked={selected} onChange={onChange} disabled={disabled || !url}/> Incluir foto {index + 1} no PDF</span>{url && <img src={url} alt={`Foto da etiqueta ${index + 1} enviada pela escola`} className="w-full h-32 object-contain rounded-lg bg-slate-50 dark:bg-slate-800"/>}{error && <span className="text-rose-600">Não foi possível carregar a foto.</span>}{!url && !error && <span className="text-slate-500">Carregando foto...</span>}</label>;
}

export default function InternetProviderDocument({ item, onClose }) {
  const [narrative, setNarrative] = useState('');
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState([]);
  const [reviewed, setReviewed] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const currentUrl = useRef('');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true; let active = true;
    api.get(`/internet/requests/${item._id}/provider-draft`).then(({ data }) => { if (active) setNarrative(data.narrative); }).catch(async e => { const text = await errorMessage(e); if (active) setError(text); }).finally(() => { if (active) setLoadingDraft(false); });
    return () => { active = false; alive.current = false; if (currentUrl.current) URL.revokeObjectURL(currentUrl.current); };
  }, [item._id]);
  function invalidate() { if (currentUrl.current) URL.revokeObjectURL(currentUrl.current); currentUrl.current = ''; setPdfUrl(''); setGeneratedAt(''); }
  function togglePhoto(index) { invalidate(); setReviewed(false); setPhotos(current => current.includes(index) ? current.filter(x => x !== index) : [...current, index].sort()); }
  async function generate() {
    if (narrative.trim().length < 10) { setError('O relato precisa ter pelo menos 10 caracteres.'); return; }
    if (photos.length && !reviewed) { setError('Confirme que conferiu as fotos antes de incluí-las.'); return; }
    invalidate(); setGenerating(true); setError('');
    try {
      const { data } = await api.post(`/internet/requests/${item._id}/provider-pdf`, { narrative, includeContact: false, photoIndexes: photos }, { responseType: 'blob' });
      if (!alive.current) return;
      const url = URL.createObjectURL(data); currentUrl.current = url; setPdfUrl(url); setGeneratedAt(new Date().toLocaleString('pt-BR'));
    } catch (e) { const text = await errorMessage(e); if (alive.current) setError(text); }
    finally { if (alive.current) setGenerating(false); }
  }
  return <div className="fixed inset-0 z-[60] bg-slate-950/70 flex items-center justify-center p-4" onClick={() => !generating && onClose()}><div role="dialog" aria-modal="true" aria-labelledby="provider-document-title" className="card w-full max-w-4xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-5" onClick={e => e.stopPropagation()}>
    <div className="flex justify-between items-start gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-blue-400">CTEC → Online Telecom</p><h2 id="provider-document-title" className="text-xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2"><FileText size={21}/> Documento para o provedor</h2><p className="text-sm text-slate-500 mt-1">{item.schoolName} · INEP {item.inep}</p></div><button className="btn-ghost !p-1" onClick={onClose} disabled={generating} aria-label="Fechar"><X size={20}/></button></div>
    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 p-4 text-sm flex gap-2"><ShieldAlert size={18} className="shrink-0"/><span>Confira as informações com a escola antes de encaminhar. Baixar o PDF não altera o status nem envia o documento à Online Telecom.</span></div>
    <div className="grid sm:grid-cols-2 gap-3 rounded-xl bg-slate-50 dark:bg-slate-800 p-4 text-sm text-slate-700 dark:text-slate-200"><p><strong>Local:</strong> {item.installation?.siteName || 'Não informado'}</p><p><strong>Endereço:</strong> {item.installation?.address || 'Não informado'}</p><p className="sm:col-span-2"><strong>GPON:</strong> {(item.installation?.identifiers || []).map(x => x.number + (x.location ? ` (${x.location})` : '')).join(' · ') || 'Não informado ou não encontrado'}</p></div>
    <div><label className="label" htmlFor="provider-narrative">Relato por extenso</label><p className="text-xs text-slate-500 mb-2">O texto foi montado a partir das respostas. Você pode editá-lo para este PDF; suas alterações não são salvas no pedido.</p>{loadingDraft ? <p className="text-sm text-slate-500">Preparando relato...</p> : <textarea id="provider-narrative" rows={11} className="input" maxLength={5000} disabled={generating} value={narrative} onChange={e => { invalidate(); setNarrative(e.target.value); }} />}</div>
    <details className="rounded-xl border border-slate-200 dark:border-slate-700 p-4"><summary className="cursor-pointer text-sm font-semibold">Conferir respostas originais do gestor</summary><p className="mt-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">{item.description || 'Não informadas'}</p><p className="text-sm text-slate-500 mt-2">Início informado na data do pedido: {item.since || 'Não informado'}</p></details>
    <p className="text-xs text-slate-500">Contato e observações internas não são incluídos automaticamente, mas o relato pode conter dados digitados pela escola. Revise antes de compartilhar.</p>
    {item.photoCount > 0 && <div className="space-y-3"><h3 className="font-semibold text-sm">Fotos opcionais</h3><p className="text-xs text-slate-500">Selecione somente fotos que podem ser enviadas. O PDF aceita JPEG e PNG; fotos WebP podem ser baixadas no detalhe e enviadas separadamente.</p><div className="grid sm:grid-cols-2 gap-3">{Array.from({ length: item.photoCount }, (_, index) => <PhotoOption key={index} id={item._id} index={index} selected={photos.includes(index)} disabled={generating} onChange={() => togglePhoto(index)}/>)}</div>{photos.length > 0 && <label className="flex gap-2 items-start text-sm"><input type="checkbox" disabled={generating} checked={reviewed} onChange={e => { invalidate(); setReviewed(e.target.checked); }}/><span>Conferi as fotos selecionadas e elas não exibem senhas ou informações que não devam ser compartilhadas.</span></label>}</div>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 p-3 text-sm">{error}</p>}
    <div className="flex flex-wrap gap-2"><button className="btn-primary" onClick={generate} disabled={loadingDraft || generating || !narrative.trim()}><Eye size={16}/> {generating ? 'Gerando...' : 'Gerar prévia em PDF'}</button>{pdfUrl && <a className="btn-secondary" href={pdfUrl} download="solicitacao-online-telecom.pdf"><FileDown size={16}/> Baixar PDF</a>}<button className="btn-ghost" onClick={onClose} disabled={generating}>Fechar</button></div>
    {pdfUrl && <div className="space-y-2"><p className="text-xs text-slate-500">Prévia gerada em {generatedAt}. Revise antes de encaminhar.</p><iframe title="Prévia do documento para a Online Telecom" src={pdfUrl} className="w-full h-[55vh] rounded-xl border border-slate-200 dark:border-slate-700"/><p className="text-xs text-slate-500">Se a prévia não aparecer no navegador, use “Baixar PDF”.</p></div>}
  </div></div>;
}
