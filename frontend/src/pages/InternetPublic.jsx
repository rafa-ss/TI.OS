import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import InternetInstallation from './InternetInstallation';
import './internet-portal.css';
import { Wifi, ArrowRight, CheckCircle2, Copy, ShieldCheck, Bot, Pencil, BookOpen } from 'lucide-react';

const publicApi = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1', timeout: 30000 });
const issueTypes = [
  ['sem_internet', 'Sem internet'], ['lenta', 'Internet lenta'], ['cai_volta', 'Internet cai e volta'],
  ['local_especifico', 'Problema em um local específico'], ['outro', 'Outro problema'],
];
const stages = [['recebida', 'Recebida pela TI'], ['verificada', 'Verificada pela TI'], ['encaminhada', 'Encaminhada ao provedor']];
const message = err => err.response?.data?.message || 'Não foi possível conectar. Tente novamente.';
const date = value => value ? new Date(value).toLocaleString('pt-BR') : '';
const choices = values => values.map(value => [value, value]);
// Orientação aprovada; pode ser desativada explicitamente no ambiente do frontend.
const restartEnabled = import.meta.env.VITE_ENABLE_ROUTER_RESTART !== 'false';
const initialInstallation = { siteName: '', address: '', equipmentCount: '', equipmentCountOther: '', gponStatus: '', identifiers: [{ number: '', location: '' }, { number: '', location: '' }] };
const initialForm = { contactName: '', phone: '', issueType: '', scope: '', location: '', since: '', sinceDetail: '', frequency: '', otherDevices: '', wifiCheck: '', lights: '', power: '', restartDone: '', previouslyReported: '', previousProtocol: '', description: '', restored: '' };

// Conversa guiada: identificar, verificar, avaliar o resultado e só então preparar o pedido.
function getQuestions(form) {
  const questions = [
    { key: 'issueType', title: 'Problema', question: 'Primeiro, o que está acontecendo com a internet?', options: issueTypes },
    { key: 'scope', title: 'Locais afetados', question: 'O problema acontece em toda a escola ou somente em algum local?', options: choices(['Toda a escola', 'Secretaria', 'Laboratório', 'Algumas salas', 'Outro local', 'Não sei informar']) },
  ];
  if (['Algumas salas', 'Outro local'].includes(form.scope)) {
    questions.push({ key: 'location', title: 'Local informado', question: 'Quais locais estão afetados? Se não souber, pode deixar em branco.', placeholder: 'Ex.: salas 1 e 2', maxLength: 120, optional: true });
  }
  questions.push(
    { key: 'since', title: 'Quando começou', question: 'Quando o problema começou?', options: choices(['Hoje', 'Ontem', 'Há mais de dois dias', 'Não sei informar']) },
    { key: 'sinceDetail', title: 'Horário aproximado', question: 'Você sabe aproximadamente o horário? Se não souber, pode deixar em branco.', placeholder: 'Ex.: por volta das 10 horas', maxLength: 100, optional: true },
  );
  if (['lenta', 'cai_volta'].includes(form.issueType)) {
    questions.push({ key: 'frequency', title: 'Frequência', question: 'O problema acontece o tempo todo ou em alguns momentos?', options: choices(['O tempo todo', 'Em determinados horários', 'De vez em quando', 'Não sei informar']) });
  }
  questions.push({ key: 'otherDevices', title: 'Teste em outro aparelho', question: 'Se possível, teste a internet em outro celular ou computador da escola.', options: choices(['Também não funciona', 'Funciona em outro aparelho', 'Não consigo verificar']) });
  if (form.otherDevices === 'Funciona em outro aparelho') {
    questions.push({ key: 'wifiCheck', title: 'Verificação do Wi-Fi', question: 'No aparelho com problema, confira se o Wi-Fi está ligado e conectado à rede correta. Se puder, desligue e ligue o Wi-Fi do próprio celular ou computador e teste novamente. Você conseguiu conferir?', options: choices(['Sim, conferi', 'Não consigo verificar']) });
  }
  questions.push(
    { key: 'lights', title: 'Luzes do equipamento', question: 'Você consegue observar as luzes do modem ou roteador, sem mexer nos cabos?', options: choices(['Parecem normais', 'Há uma luz vermelha ou apagada', 'O equipamento parece desligado', 'Não consigo verificar']) },
    { key: 'power', title: 'Falta de energia', question: 'Houve falta ou oscilação de energia antes do problema?', options: choices(['Sim', 'Não', 'Não sei informar']) },
  );
  // Orientação aprovada para escolas sem internet também em outro aparelho.
  if (restartEnabled && form.issueType === 'sem_internet' && form.otherDevices === 'Também não funciona') {
    questions.push({ key: 'restartDone', title: 'Reinício do equipamento', question: 'Vamos tentar reiniciar o equipamento de internet uma vez. Se você identificar o equipamento correto e for seguro, siga estes passos:', instructions: ['Com as mãos e o acesso secos, desligue pelo botão de energia ou retire apenas a fonte da tomada.', 'Aguarde 10 segundos e ligue novamente.', 'Espere alguns minutos para iniciar e teste a conexão.'], warning: 'O reinício interrompe temporariamente a internet. Não faça se puder afetar um serviço essencial ou se não identificar o equipamento. Não toque no cabo de fibra, não desconecte outros cabos e não aperte RESET. Se tiver dúvida, pare e escolha a opção de não conseguir ou não ser seguro. Não feche esta página durante a tentativa.', options: choices(['Reiniciei uma vez', 'Não consegui ou não foi seguro']) });
  }
  questions.push({ key: 'restored', title: 'Resultado das verificações', question: 'Depois das verificações, a internet voltou a funcionar?', options: choices(['Sim, voltou', 'Não, continua com problema', 'Não sei']) });
  // Se o problema foi resolvido, nenhum pedido será aberto nem enviado.
  if (form.restored === 'Não, continua com problema' || form.restored === 'Não sei') {
    questions.push({ key: 'previouslyReported', title: 'Contato anterior com a TI', question: 'Esse problema já foi informado à equipe de TI?', options: choices(['Sim', 'Não', 'Não sei informar']) });
    if (form.previouslyReported === 'Sim') {
      questions.push({ key: 'previousProtocol', title: 'Protocolo anterior', question: 'Se tiver um protocolo anterior, informe-o. Caso não tenha, pode deixar em branco.', placeholder: 'Protocolo anterior (opcional)', maxLength: 120, optional: true });
    }
    questions.push({ key: 'description', title: 'Informações adicionais', question: 'Há mais alguma informação que possa ajudar a equipe? Esta resposta é opcional.', placeholder: 'Conte o que achar importante', maxLength: 1000, optional: true, multiline: true });
  }
  return questions;
}
function answerText(question, form) {
  if (question.options) return question.options.find(([value]) => value === form[question.key])?.[1] || 'Não informado';
  return form[question.key]?.trim() || 'Não informado';
}
function apiIssueType(value) { return value === 'lenta' || value === 'cai_volta' ? 'lenta_instavel' : value; }

function GuidedConversation({ form, setForm, chatKey, setChatKey, onBack, onComplete }) {
  const questions = getQuestions(form);
  const currentIndex = Math.max(0, questions.findIndex(q => q.key === chatKey));
  const current = questions[currentIndex];
  const historyRef = useRef(null);
  useEffect(() => { if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight; }, [current.key]);

  function advance(nextForm) {
    const nextQuestions = getQuestions(nextForm);
    const index = nextQuestions.findIndex(q => q.key === current.key);
    if (index >= nextQuestions.length - 1) onComplete(nextForm);
    else setChatKey(nextQuestions[index + 1].key);
  }
  function choose(value) {
    const next = { ...form, [current.key]: value };
    // Não incluir respostas antigas de caminhos que deixaram de existir.
    if (current.key === 'scope' && value !== form.scope) next.location = '';
    if (current.key === 'issueType' && value !== form.issueType) { next.frequency = ''; next.restartDone = ''; }
    if (current.key === 'otherDevices' && value !== form.otherDevices) { next.wifiCheck = ''; next.restartDone = ''; }
    if (current.key === 'previouslyReported' && value !== form.previouslyReported) next.previousProtocol = '';
    setForm(next);
    advance(next);
  }
  function previous() {
    if (currentIndex === 0) onBack();
    else setChatKey(questions[currentIndex - 1].key);
  }
  return <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-soft">
    <div className="bg-brand-600 text-white px-4 py-3 flex items-center gap-3"><span className="p-2 bg-white/20 rounded-xl"><Bot size={20}/></span><div><p className="font-semibold">Assistente da TI</p><p className="text-xs text-white/80">Atendimento guiado · uma pergunta por vez</p></div></div>
    <div ref={historyRef} className="bg-slate-50 dark:bg-slate-950/50 p-4 space-y-4 max-h-[45vh] overflow-y-auto" aria-live="polite" aria-relevant="additions text">
      <div className="flex justify-start"><div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800 px-4 py-3 text-sm shadow-sm">Olá! Vamos verificar o problema juntos. Se não conseguir fazer alguma verificação, você pode continuar mesmo assim.</div></div>
      {questions.slice(0, currentIndex + 1).map((question, index) => <div key={question.key} className="space-y-2">
        <div className="flex justify-start"><div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800 px-4 py-3 text-sm shadow-sm">{question.question}{question.instructions && <ol className="list-decimal pl-5 mt-2 space-y-1">{question.instructions.map(instruction => <li key={instruction}>{instruction}</li>)}</ol>}{question.warning && <p className="mt-3 font-semibold text-amber-700 dark:text-amber-300">{question.warning}</p>}</div></div>
        {index < currentIndex && <div className="flex justify-end"><div className="max-w-[90%] rounded-2xl rounded-tr-sm bg-brand-600 px-4 py-3 text-sm text-white whitespace-pre-wrap break-words">{answerText(question, form)}</div></div>}
      </div>)}
    </div>
    <div className="p-4 space-y-3 bg-white dark:bg-slate-900">
      {current.options ? <div className="flex flex-wrap gap-2" aria-label="Opções de resposta">{current.options.map(([value, label]) => <button type="button" key={value} onClick={() => choose(value)} className="btn-secondary text-left">{label}</button>)}</div> : <form onSubmit={e => { e.preventDefault(); advance(form); }} className="space-y-3">
        <label className="label" htmlFor={`chat-${current.key}`}>Sua resposta (opcional)</label>
        {current.multiline ? <textarea id={`chat-${current.key}`} className="input" rows={3} value={form[current.key]} onChange={e => setForm(f => ({ ...f, [current.key]: e.target.value }))} maxLength={current.maxLength} placeholder={current.placeholder}/> : <input id={`chat-${current.key}`} className="input" value={form[current.key]} onChange={e => setForm(f => ({ ...f, [current.key]: e.target.value }))} maxLength={current.maxLength} placeholder={current.placeholder}/>}
        <button className="btn-primary">Continuar <ArrowRight size={16}/></button>
      </form>}
    </div>
    <div className="flex items-center justify-between gap-2 px-4 pb-4 bg-white dark:bg-slate-900"><button type="button" className="btn-secondary" onClick={previous}>{currentIndex === 0 ? 'Voltar para escola' : 'Voltar à pergunta anterior'}</button><span className="text-xs text-slate-500">Pergunta {currentIndex + 1} de {questions.length}</span></div>
  </div>;
}

export default function InternetPublic() {
  const location = useLocation();
  const isTracking = location.pathname.endsWith('/acompanhar');
  const [step, setStep] = useState(0);
  const [inep, setInep] = useState('');
  const [school, setSchool] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [chatKey, setChatKey] = useState('issueType');
  const [installation, setInstallation] = useState(initialInstallation);
  const [photos, setPhotos] = useState([]);
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [tracking, setTracking] = useState(null);
  const [copied, setCopied] = useState(false);
  const token = location.hash.slice(1);
  const questions = getQuestions(form);
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!isTracking) return;
    if (!/^[a-f0-9]{64}$/.test(token)) { setError('Link de acompanhamento inválido.'); return; }
    setBusy(true); setError('');
    publicApi.post('/internet/public/tracking', { token }).then(({ data }) => setTracking(data.request)).catch(e => setError(message(e))).finally(() => setBusy(false));
  }, [isTracking, token]);
  async function lookup(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try { const { data } = await publicApi.get(`/internet/public/school/${inep}`);
      if (!school || school.inep !== data.school.inep) {
        setInstallation({ ...initialInstallation, siteName: data.school.name, address: '', identifiers: [{ number: '', location: '' }, { number: '', location: '' }] });
        setPhotos([]);
      }
      setSchool(data.school); setStep(1); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function submit(e) {
    e.preventDefault(); if (busy) return; setError('');
    if ((form.phone.match(/\d/g) || []).length < 10) { setError('Informe um telefone válido com DDD.'); return; }
    if (form.restored === 'Sim, voltou') { setError('A conexão foi marcada como restabelecida. Volte à conversa se deseja alterar essa resposta.'); return; }
    // O backend e os relatórios existentes continuam compatíveis: respostas extras vão para a descrição.
    const details = questions.filter(q => q.key !== 'since').map(q => `${q.title}: ${answerText(q, form)}`).join('\n');
    if (details.length > 2000) { setError('As informações são muito longas. Reduza os detalhes antes de enviar.'); return; }
    setBusy(true);
    try {
      const count = installation.gponStatus === '1' ? 1 : installation.gponStatus === '2' ? 2 : 0;
      const install = { ...installation, identifiers: installation.identifiers.slice(0, count) };
      const payload = { inep: school.inep, contactName: form.contactName, phone: form.phone, issueType: apiIssueType(form.issueType), since: form.since, description: details, website, installation: install };
      let body = payload;
      if (photos.length) { body = new FormData(); body.append('payload', JSON.stringify(payload)); photos.forEach(photo => body.append('photos', photo)); }
      const { data } = await publicApi.post('/internet/public/requests', body);
      setLink(`${window.location.origin}/internet-escolas/acompanhar#${data.token}`); setStep(4);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setCopied(true); }
    catch { setError('Não foi possível copiar automaticamente. Selecione e copie o link abaixo.'); }
  }
  function editAnswer(key) { setError(''); setChatKey(key); setStep(2); }
  function startAgain() { setForm(initialForm); setChatKey('issueType'); setInstallation({ ...initialInstallation, siteName: school?.name || '', address: '', identifiers: [{ number: '', location: '' }, { number: '', location: '' }] }); setPhotos([]); setError(''); setStep(1); }
  return (
    <main className="internet-portal dark relative min-h-screen overflow-hidden bg-[#00132e] px-3 py-5 text-slate-100 sm:px-6 sm:py-7">
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="none">
        <defs><linearGradient id="portal-blue" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0961c8"/><stop offset="1" stopColor="#022353"/></linearGradient><radialGradient id="portal-glow"><stop offset="0" stopColor="#064a9c" stopOpacity=".48"/><stop offset="1" stopColor="#00132e" stopOpacity="0"/></radialGradient></defs>
        <rect width="1440" height="900" fill="#00132e"/><ellipse cx="680" cy="385" rx="810" ry="610" fill="url(#portal-glow)"/><path d="M0 0 H225 C135 40 65 80 0 137 Z" fill="url(#portal-blue)" opacity=".8"/><path d="M1440 128 C1373 173 1342 255 1236 300 L1440 240 Z" fill="url(#portal-blue)" opacity=".8"/><path d="M0 820 C160 710 229 680 360 672 L45 900 H0 Z" fill="url(#portal-blue)" opacity=".7"/><path d="M1440 725 C1326 772 1279 847 1210 900 H1440 Z" fill="url(#portal-blue)" opacity=".7"/>
      </svg>
      <div className="relative mx-auto w-full max-w-[880px] overflow-hidden rounded-[22px] border border-[#17437c] bg-[#00132f]/95 shadow-[0_20px_65px_rgba(0,0,0,0.35)]">
        <header className="flex items-center justify-between gap-3 border-b border-[#184278] bg-gradient-to-r from-[#082654] to-[#06366f] px-4 py-3 sm:px-7 sm:py-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5"><BookOpen size={37} strokeWidth={1.8} className="shrink-0 text-white" aria-hidden="true"/><span aria-hidden="true" className="h-10 w-px shrink-0 bg-sky-300/80"/><div className="min-w-0"><p className="text-sm font-extrabold leading-tight text-white sm:text-base">SEMEC ABAETETUBA</p><p className="mt-1 text-[11px] leading-snug text-blue-100 sm:text-xs">CTEC – Coordenação de Tecnologia Educacional</p></div></div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-900/60 px-2.5 py-1 text-[11px] font-semibold text-emerald-200"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-emerald-400"/>Atendimento</span>
        </header>
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-3"><div className="rounded-2xl border border-[#1b4e87] bg-[#073774] p-3 text-sky-300"><Wifi size={25} aria-hidden="true"/></div><div><div className="text-xs font-bold uppercase tracking-widest text-sky-300">CTEC · SEMEC</div><h1 className="text-xl font-bold text-white sm:text-2xl">Internet das Escolas</h1></div></div>
        <div className={isTracking || step !== 2 ? 'card p-5 sm:p-8 space-y-5' : 'space-y-5'}>
          {isTracking ? <>
            <div><p className="text-sm text-brand-600 font-semibold">Acompanhamento</p><h2 className="text-2xl font-bold mt-1">Sua solicitação</h2></div>
            {busy && <p>Consultando a solicitação...</p>}
            {tracking && <><p className="text-slate-600 dark:text-slate-300">Escola: <strong>{tracking.schoolName}</strong></p><div className="space-y-4">{stages.map(([key, label], index) => { const active = stages.findIndex(s => s[0] === tracking.status) >= index; const d = [tracking.createdAt, tracking.verifiedAt, tracking.forwardedAt][index]; return <div key={key} className={`flex items-start gap-3 rounded-xl p-4 ${active ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-slate-100 dark:bg-slate-800'}`}><CheckCircle2 size={20} className={active ? 'text-emerald-600 shrink-0' : 'text-slate-400 shrink-0'}/><div><strong>{label}</strong>{d && <p className="text-sm text-slate-500">{date(d)}</p>}</div></div>; })}</div><p className="text-sm text-slate-500">O encaminhamento não significa que o problema já foi resolvido pelo provedor.</p><p className="text-sm text-slate-500">Guarde este link em local seguro. Qualquer pessoa com ele poderá acompanhar a solicitação.</p></>}
          </> : <>
            {(step === 0 || step === 1) && <div><p className="text-sm font-semibold text-brand-600">Atendimento para gestores escolares</p><h2 className="text-2xl font-bold mt-1">Vamos informar a equipe de TI?</h2><p className="text-sm text-slate-500 mt-2">A TI verificará sua solicitação e, quando necessário, a encaminhará ao provedor. Se a internet da escola não funcionar, acesse usando os dados móveis do celular.</p></div>}
            {step === 0 && <form onSubmit={lookup} className="space-y-4"><label className="label" htmlFor="inep">Qual é o INEP da escola?</label><input id="inep" className="input" inputMode="numeric" value={inep} onChange={e => setInep(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="8 dígitos" pattern="[0-9]{8}" required/><button className="btn-primary" disabled={busy}>{busy ? 'Buscando...' : 'Buscar escola'} <ArrowRight size={16}/></button></form>}
            {step === 1 && <div className="space-y-4"><p>Encontramos esta escola. Está correta?</p><div className="rounded-xl bg-brand-50 dark:bg-slate-800 p-4"><strong>{school.name}</strong><p className="text-sm text-slate-500">INEP {school.inep}</p></div><div className="flex gap-2"><button className="btn-secondary" onClick={() => setStep(0)}>Corrigir INEP</button><button className="btn-primary" onClick={() => setStep(2)}>Sim, continuar</button></div></div>}
            {step === 2 && <GuidedConversation form={form} setForm={setForm} chatKey={chatKey} setChatKey={setChatKey} onBack={() => setStep(1)} onComplete={next => { setError(''); setStep(next.restored === 'Sim, voltou' ? 5 : 6); }} />}
            {step === 6 && <InternetInstallation value={installation} setValue={setInstallation} photos={photos} setPhotos={setPhotos} onBack={() => editAnswer(questions[questions.length - 1].key)} onContinue={() => { setError(''); setStep(3); }} />}
            {step === 3 && <form onSubmit={submit} className="space-y-4"><div><p className="text-sm font-semibold text-brand-600">Revise antes de enviar</p><h2 className="text-2xl font-bold mt-1">Confirme sua solicitação</h2><p className="text-sm text-slate-500 mt-2">Confira as respostas e informe um contato para a equipe de TI.</p></div><div><label className="label" htmlFor="name">Seu nome</label><input id="name" className="input" value={form.contactName} onChange={e => set('contactName', e.target.value)} minLength={2} maxLength={100} required/></div><div><label className="label" htmlFor="phone">Telefone para contato, com DDD</label><input id="phone" className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} minLength={10} maxLength={30} required/></div><div className="hidden" aria-hidden="true"><label>Site<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)}/></label></div><div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 text-sm space-y-3"><p><strong>Escola:</strong> {school.name} · INEP {school.inep}</p><div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2"><div className="flex items-center justify-between gap-2"><strong>Local e equipamentos</strong><button type="button" className="text-brand-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1" onClick={() => setStep(6)}><Pencil size={14}/> Corrigir</button></div><p><strong>Nome do local:</strong> {installation.siteName}</p><p className="whitespace-pre-wrap break-words"><strong>Endereço:</strong> {installation.address}</p><p><strong>Aparelhos:</strong> {installation.equipmentCount === 'unknown' ? 'Não sei informar' : installation.equipmentCount === 'other' ? installation.equipmentCountOther : installation.equipmentCount}</p><p><strong>Identificação:</strong> {({ not_found: 'Não encontrada', cannot_check: 'Não conseguiu verificar', '1': 'Encontrada em 1 aparelho', '2': 'Encontrada em 2 aparelhos' })[installation.gponStatus]}</p>{installation.identifiers.slice(0, installation.gponStatus === '1' ? 1 : installation.gponStatus === '2' ? 2 : 0).map((item, index) => <p key={index}><strong>SN GPON {index + 1}:</strong> {item.number}{item.location ? ` · ${item.location}` : ''}</p>)}<p><strong>Fotos:</strong> {photos.length ? photos.map(f => f.name).join(', ') : 'Nenhuma'}</p></div>{questions.map(q => <div key={q.key} className="flex items-start justify-between gap-3 border-t border-slate-200 dark:border-slate-700 pt-2"><div className="min-w-0"><strong>{q.title}:</strong> <span className="whitespace-pre-wrap break-words">{answerText(q, form)}</span></div><button type="button" className="shrink-0 text-brand-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1" onClick={() => editAnswer(q.key)} aria-label={`Corrigir ${q.title}`}><Pencil size={14}/> Corrigir</button></div>)}</div><p className="text-sm text-slate-500">Os dados informados serão usados pela equipe de TI para analisar e encaminhar esta solicitação. O INEP identifica a escola, mas não confirma a identidade de quem envia.</p><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" onClick={() => setStep(6)}>Voltar</button><button className="btn-primary" disabled={busy}>{busy ? 'Enviando...' : 'Confirmar e enviar'}</button></div></form>}
            {step === 4 && <><CheckCircle2 className="text-emerald-600" size={36}/><div><h2 className="text-2xl font-bold">Solicitação recebida!</h2><p className="text-slate-500 mt-2">Guarde o link abaixo para acompanhar a verificação e o encaminhamento. Ele não será enviado automaticamente.</p></div><label className="label" htmlFor="tracking-link">Seu link individual</label><input id="tracking-link" className="input" value={link} readOnly onFocus={e => e.target.select()}/><button className="btn-primary" onClick={copyLink}><Copy size={16}/> {copied ? 'Copiado!' : 'Copiar link'}</button><p className="text-sm text-slate-500"><ShieldCheck size={16} className="inline mr-1"/>Qualquer pessoa com este link poderá acompanhar sua solicitação. Guarde-o em local seguro.</p><a className="block text-brand-600 underline" href={link}>Abrir acompanhamento</a></>}
            {step === 5 && <><CheckCircle2 className="text-emerald-600" size={36}/><div><h2 className="text-2xl font-bold">Que bom que a conexão voltou!</h2><p className="text-slate-500 mt-2">Nenhuma solicitação foi enviada à equipe de TI. Se precisar de ajuda, você pode voltar e alterar sua resposta ou começar novamente.</p></div><div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => editAnswer('restored')}>Voltar à última pergunta</button><button className="btn-primary" onClick={startAgain}>Iniciar outro atendimento</button></div></>}
          </>}
          {error && <p role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 p-3 text-sm">{error}</p>}
        </div>
        {(isTracking || step !== 2) && <p className="text-center text-xs text-slate-500 mt-6">Atendimento da equipe de TI · SEMEC</p>}
        {isTracking && <div className="text-center mt-3"><Link to="/internet-escolas" className="text-sm text-brand-600 underline">Abrir outra solicitação</Link></div>}
        </div>
      </div>
    </main>
  );
}
