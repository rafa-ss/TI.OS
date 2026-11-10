import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Wifi, ArrowRight, CheckCircle2, Copy, ShieldCheck, Bot } from 'lucide-react';

const publicApi = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1', timeout: 30000 });
const issueTypes = [ ['sem_internet', 'Escola sem internet'], ['lenta_instavel', 'Internet lenta ou instável'], ['local_especifico', 'Problema em um local específico'], ['outro', 'Outro problema'] ];
const stages = [ ['recebida', 'Recebida pela TI'], ['verificada', 'Verificada pela TI'], ['encaminhada', 'Encaminhada ao provedor'] ];
const message = err => err.response?.data?.message || 'Não foi possível conectar. Tente novamente.';
const date = value => value ? new Date(value).toLocaleString('pt-BR') : '';

// Conversa guiada local, sem IA: as respostas só são enviadas na confirmação final.
const chatQuestions = [
  { key: 'issueType', question: 'Primeiro, o que está acontecendo com a internet?', options: issueTypes },
  { key: 'scope', question: 'O problema acontece em toda a escola ou somente em algum local?', options: [['Toda a escola', 'Toda a escola'], ['Apenas em alguns locais', 'Apenas em alguns locais'], ['Não sei informar', 'Não sei informar']] },
  { key: 'since', question: 'Desde quando você percebeu o problema?', placeholder: 'Ex.: desde ontem pela manhã' },
  { key: 'lights', question: 'Você consegue verificar as luzes do modem ou roteador? Como elas estão?', options: [['Acesas normalmente', 'Acesas normalmente'], ['Alguma luz apagada ou vermelha', 'Alguma luz apagada ou vermelha'], ['Não consigo verificar', 'Não consigo verificar']] },
  { key: 'description', question: 'Quer acrescentar alguma informação para ajudar a equipe? Esta resposta é opcional.', placeholder: 'Ex.: a secretaria também está sem conexão' },
];

function GuidedConversation({ form, set, chatStep, setChatStep, onBack, onComplete }) {
  const current = chatQuestions[chatStep];
  function advance() {
    if (chatStep === chatQuestions.length - 1) onComplete();
    else setChatStep(chatStep + 1);
  }
  function choose(value) { set(current.key, value); advance(); }
  function previous() {
    if (chatStep === 0) onBack();
    else setChatStep(chatStep - 1);
  }
  function answerText(q) {
    if (q.key === 'issueType') return issueTypes.find(([value]) => value === form[q.key])?.[1] || '';
    return form[q.key] || 'Nenhuma informação adicional';
  }
  return <div className="space-y-4">
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-soft">
      <div className="bg-brand-600 text-white px-4 py-3 flex items-center gap-3"><span className="p-2 bg-white/20 rounded-xl"><Bot size={20}/></span><div><p className="font-semibold">Assistente da TI</p><p className="text-xs text-white/80">Atendimento guiado · uma pergunta por vez</p></div></div>
      <div className="bg-slate-50 dark:bg-slate-950/50 p-4 space-y-4" aria-live="polite" aria-relevant="additions text">
        <div className="flex justify-start"><div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800 px-4 py-3 text-sm shadow-sm">Olá! Vou fazer algumas perguntas para ajudar a equipe de TI a entender o problema da escola.</div></div>
        {chatQuestions.slice(0, chatStep + 1).map((question, index) => <div key={question.key} className="space-y-2">
          <div className="flex justify-start"><div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800 px-4 py-3 text-sm shadow-sm">{question.question}</div></div>
          {index < chatStep && <div className="flex justify-end"><div className="max-w-[90%] rounded-2xl rounded-tr-sm bg-brand-600 px-4 py-3 text-sm text-white whitespace-pre-wrap break-words">{answerText(question)}</div></div>}
        </div>)}
      </div>
      <div className="p-4 space-y-3 bg-white dark:bg-slate-900">
        {current.options ? <div className="flex flex-wrap gap-2" aria-label="Opções de resposta">{current.options.map(([value, label]) => <button type="button" key={value} onClick={() => choose(value)} className="btn-secondary text-left">{label}</button>)}</div> : <form onSubmit={e => { e.preventDefault(); if (current.key === 'since' && form.since.trim().length < 2) return; advance(); }} className="space-y-3">
          <label className="label" htmlFor={`chat-${current.key}`}>Sua resposta{current.key === 'description' && ' (opcional)'}</label>
          {current.key === 'description' ? <textarea id={`chat-${current.key}`} className="input" rows={3} value={form.description} onChange={e => set('description', e.target.value)} maxLength={1500} placeholder={current.placeholder}/> : <input id={`chat-${current.key}`} className="input" value={form.since} onChange={e => set('since', e.target.value)} minLength={2} maxLength={100} required placeholder={current.placeholder}/>}
          <button className="btn-primary">{current.key === 'description' ? 'Continuar para contato' : 'Enviar resposta'} <ArrowRight size={16}/></button>
        </form>}
      </div>
      <div className="flex items-center justify-between gap-2 px-4 pb-4 bg-white dark:bg-slate-900"><button type="button" className="btn-secondary" onClick={previous}>{chatStep === 0 ? 'Voltar para escola' : 'Voltar à pergunta anterior'}</button><span className="text-xs text-slate-500">Pergunta {chatStep + 1} de {chatQuestions.length}</span></div>
    </div>
  </div>;
}

export default function InternetPublic() {
  const location = useLocation();
  const isTracking = location.pathname.endsWith('/acompanhar');
  const [step, setStep] = useState(0);
  const [inep, setInep] = useState('');
  const [school, setSchool] = useState(null);
  const [form, setForm] = useState({ contactName: '', phone: '', issueType: '', scope: '', since: '', lights: '', description: '' });
  const [chatStep, setChatStep] = useState(0);
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [tracking, setTracking] = useState(null);
  const [copied, setCopied] = useState(false);
  const token = location.hash.slice(1);
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!isTracking) return;
    if (!/^[a-f0-9]{64}$/.test(token)) { setError('Link de acompanhamento inválido.'); return; }
    setBusy(true); setError('');
    publicApi.post('/internet/public/tracking', { token }).then(({ data }) => setTracking(data.request)).catch(e => setError(message(e))).finally(() => setBusy(false));
  }, [isTracking, token]);

  async function lookup(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try { const { data } = await publicApi.get(`/internet/public/school/${inep}`); setSchool(data.school); setStep(1); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function submit(e) {
    e.preventDefault(); if (busy) return; setError(''); setBusy(true);
    try {
      const details = `Abrangência: ${form.scope}\nLuzes do modem/roteador: ${form.lights}\nInformações adicionais: ${form.description.trim() || 'Não informadas'}`;
      const { data } = await publicApi.post('/internet/public/requests', { inep: school.inep, contactName: form.contactName, phone: form.phone, issueType: form.issueType, since: form.since, description: details, website });
      setLink(`${window.location.origin}/internet-escolas/acompanhar#${data.token}`); setStep(4);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setCopied(true); }
    catch { setError('Não foi possível copiar automaticamente. Selecione e copie o link abaixo.'); }
  }
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-4 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8"><div className="bg-brand-600 text-white p-3 rounded-2xl"><Wifi size={25}/></div><div><div className="text-xs font-bold tracking-widest text-brand-600 uppercase">CTEC · SEMEC</div><h1 className="text-xl sm:text-2xl font-bold">Internet das Escolas</h1></div></div>
        <div className={isTracking || step !== 2 ? "card p-5 sm:p-8 space-y-5" : "space-y-5"}>
          {isTracking ? <>
            <div><p className="text-sm text-brand-600 font-semibold">Acompanhamento</p><h2 className="text-2xl font-bold mt-1">Sua solicitação</h2></div>
            {busy && <p>Consultando a solicitação...</p>}
            {tracking && <><p className="text-slate-600 dark:text-slate-300">Escola: <strong>{tracking.schoolName}</strong></p><div className="space-y-4">{stages.map(([key, label], index) => { const active = stages.findIndex(s => s[0] === tracking.status) >= index; const d = [tracking.createdAt, tracking.verifiedAt, tracking.forwardedAt][index]; return <div key={key} className={`flex items-start gap-3 rounded-xl p-4 ${active ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-slate-100 dark:bg-slate-800'}`}><CheckCircle2 size={20} className={active ? 'text-emerald-600 shrink-0' : 'text-slate-400 shrink-0'}/><div><strong>{label}</strong>{d && <p className="text-sm text-slate-500">{date(d)}</p>}</div></div>; })}</div><p className="text-sm text-slate-500">O encaminhamento não significa que o problema já foi resolvido pelo provedor.</p><p className="text-sm text-slate-500">Guarde este link em local seguro. Qualquer pessoa com ele poderá acompanhar a solicitação.</p></>}
          </> : <>
            {step < 4 && step !== 2 && <><div><p className="text-sm font-semibold text-brand-600">Atendimento para gestores escolares</p><h2 className="text-2xl font-bold mt-1">Vamos informar a equipe de TI?</h2><p className="text-sm text-slate-500 mt-2">Conte o que está acontecendo. A TI verificará sua solicitação e, quando necessário, a encaminhará ao provedor.</p></div><div className="text-xs font-semibold text-slate-500">ETAPA {Math.min(step + 1, 4)} DE 4</div></>}
            {step === 0 && <form onSubmit={lookup} className="space-y-4"><label className="label" htmlFor="inep">Qual é o INEP da escola?</label><input id="inep" className="input" inputMode="numeric" value={inep} onChange={e => setInep(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="8 dígitos" pattern="[0-9]{8}" required/><button className="btn-primary" disabled={busy}>{busy ? 'Buscando...' : 'Buscar escola'} <ArrowRight size={16}/></button></form>}
            {step === 1 && <div className="space-y-4"><p>Encontramos esta escola. Está correta?</p><div className="rounded-xl bg-brand-50 dark:bg-slate-800 p-4"><strong>{school.name}</strong><p className="text-sm text-slate-500">INEP {school.inep}</p></div><div className="flex gap-2"><button className="btn-secondary" onClick={() => setStep(0)}>Corrigir INEP</button><button className="btn-primary" onClick={() => setStep(2)}>Sim, continuar</button></div></div>}
            {step === 2 && <GuidedConversation form={form} set={set} chatStep={chatStep} setChatStep={setChatStep} onBack={() => setStep(1)} onComplete={() => { setError(''); setStep(3); }} />}
            {step === 3 && <form onSubmit={submit} className="space-y-4"><div><label className="label" htmlFor="name">Seu nome</label><input id="name" className="input" value={form.contactName} onChange={e => set('contactName', e.target.value)} minLength={2} maxLength={100} required/></div><div><label className="label" htmlFor="phone">Telefone para contato, com DDD</label><input id="phone" className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} minLength={10} maxLength={30} required/></div><div className="hidden" aria-hidden="true"><label>Site<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)}/></label></div><div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 text-sm space-y-2"><p><strong>Escola:</strong> {school.name}</p><p><strong>Problema:</strong> {issueTypes.find(i => i[0] === form.issueType)?.[1]}</p><p><strong>Abrangência:</strong> {form.scope}</p><p><strong>Desde:</strong> {form.since}</p><p><strong>Luzes do modem/roteador:</strong> {form.lights}</p><p className="whitespace-pre-wrap break-words"><strong>Informações adicionais:</strong> {form.description || 'Não informadas'}</p></div><p className="text-sm text-slate-500">Os dados informados serão usados pela equipe de TI para analisar e encaminhar esta solicitação. O INEP identifica a escola, mas não confirma a identidade de quem envia.</p><div className="flex gap-2"><button type="button" className="btn-secondary" onClick={() => setStep(2)}>Voltar</button><button className="btn-primary" disabled={busy}>{busy ? 'Enviando...' : 'Confirmar e enviar'}</button></div></form>}
            {step === 4 && <><CheckCircle2 className="text-emerald-600" size={36}/><div><h2 className="text-2xl font-bold">Solicitação recebida!</h2><p className="text-slate-500 mt-2">Guarde o link abaixo para acompanhar a verificação e o encaminhamento. Ele não será enviado automaticamente.</p></div><label className="label" htmlFor="tracking-link">Seu link individual</label><input id="tracking-link" className="input" value={link} readOnly onFocus={e => e.target.select()}/><button className="btn-primary" onClick={copyLink}><Copy size={16}/> {copied ? 'Copiado!' : 'Copiar link'}</button><p className="text-sm text-slate-500"><ShieldCheck size={16} className="inline mr-1"/>Qualquer pessoa com este link poderá acompanhar sua solicitação. Guarde-o em local seguro.</p><a className="block text-brand-600 underline" href={link}>Abrir acompanhamento</a></>}
          </>}
          {error && <p role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 p-3 text-sm">{error}</p>}
        </div>
        {(isTracking || step !== 2) && <p className="text-center text-xs text-slate-500 mt-6">Atendimento da equipe de TI · SEMEC</p>}
        {isTracking && <div className="text-center mt-3"><Link to="/internet-escolas" className="text-sm text-brand-600 underline">Abrir outra solicitação</Link></div>}
      </div>
    </main>
  );
}
