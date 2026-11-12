import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import InternetPublic from './InternetPublic';
import { AlertTriangle, BookOpen, Check, ChevronRight, Info, LogIn, Wifi } from 'lucide-react';

export default function InternetNotice() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  // O comunicado é uma etapa visual da mesma rota pública existente.
  if (location.state?.startInternetService === true) return <InternetPublic />;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#00132e] px-3 py-5 text-white sm:px-6 sm:py-7">
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="none">
        <defs><linearGradient id="notice-blue" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0961c8"/><stop offset="1" stopColor="#022353"/></linearGradient><radialGradient id="notice-glow"><stop offset="0" stopColor="#064a9c" stopOpacity=".48"/><stop offset="1" stopColor="#00132e" stopOpacity="0"/></radialGradient></defs>
        <rect width="1440" height="900" fill="#00132e"/><ellipse cx="680" cy="385" rx="810" ry="610" fill="url(#notice-glow)"/><path d="M0 0 H225 C135 40 65 80 0 137 Z" fill="url(#notice-blue)" opacity=".8"/><path d="M1440 128 C1373 173 1342 255 1236 300 L1440 240 Z" fill="url(#notice-blue)" opacity=".8"/><path d="M0 820 C160 710 229 680 360 672 L45 900 H0 Z" fill="url(#notice-blue)" opacity=".7"/><path d="M1440 725 C1326 772 1279 847 1210 900 H1440 Z" fill="url(#notice-blue)" opacity=".7"/>
      </svg>

      <div className="relative mx-auto w-full max-w-[880px] overflow-hidden rounded-[22px] border border-[#17437c] bg-[#00132f]/95 shadow-[0_20px_65px_rgba(0,0,0,0.35)]">
        <header className="flex items-center justify-between gap-3 border-b border-[#184278] bg-gradient-to-r from-[#082654] to-[#06366f] px-4 py-3 sm:px-7 sm:py-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <BookOpen size={37} strokeWidth={1.8} className="shrink-0 text-white" aria-hidden="true" />
            <span aria-hidden="true" className="h-10 w-px shrink-0 bg-sky-300/80" />
            <div className="min-w-0"><p className="text-sm font-extrabold leading-tight text-white sm:text-base">SEMEC ABAETETUBA</p><p className="mt-1 text-[11px] leading-snug text-blue-100 sm:text-xs">CTEC – Coordenação de Tecnologia Educacional</p></div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-900/60 px-2.5 py-1 text-[11px] font-semibold text-emerald-200"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]"/>Atendimento</span>
        </header>

        <div className="px-4 pb-5 sm:px-5 sm:pb-4">
          <div className="pt-3 text-center sm:pt-1">
            <div className="mx-auto flex h-[82px] w-[82px] items-center justify-center rounded-full border-2 border-amber-400 bg-[#081b38] ring-[5px] ring-[#08234b] shadow-[0_0_20px_rgba(245,158,11,0.12)]"><AlertTriangle size={51} strokeWidth={1.8} className="text-amber-400" aria-hidden="true" /></div>
            <h1 className="mt-2 text-[32px] font-extrabold leading-none tracking-tight text-white sm:text-[42px]">ATENÇÃO!<span className="mt-1.5 block text-lg font-bold tracking-normal text-slate-100 sm:text-[25px]">COMUNICADO IMPORTANTE</span></h1>
            <div aria-hidden="true" className="mx-auto mt-2 h-0.5 w-52 max-w-[50%] rounded-full bg-sky-500" />
            <p className="mt-2 text-sm text-slate-300 sm:text-base">Antes de continuar, leia as informações abaixo.</p>
          </div>

          <section aria-label="Comunicado para as unidades escolares" className="mt-4 rounded-[18px] border border-[#173e70] bg-[#061b3b]/90 p-4 text-[15px] leading-6 text-slate-100 sm:px-5 sm:py-4 sm:text-base">
            <p className="font-bold text-white">Prezados gestores e responsáveis pelas unidades escolares,</p>
            <p className="mt-3">Informamos que este canal de atendimento é de <strong className="text-sky-300">uso exclusivo das unidades escolares da Rede Municipal de Ensino</strong> que recebem o serviço de conexão à internet disponibilizado pela Secretaria Municipal de Educação (SEMEC), por meio do provedor <strong className="text-sky-300">ONLINE TELECOM</strong>.</p>

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[18px] border border-[#1b4e87] bg-gradient-to-r from-[#052653] to-[#073774] px-4 py-3 sm:flex-nowrap sm:gap-5 sm:px-6">
              <div className="flex items-center gap-4 sm:gap-6"><Wifi size={43} strokeWidth={2.7} className="shrink-0 text-[#14a5ff]" aria-hidden="true" /><span aria-hidden="true" className="h-12 w-px bg-sky-300/80" /><div><p className="text-base font-extrabold leading-tight text-white sm:text-xl">ONLINE TELECOM</p><p className="mt-1 text-xs text-blue-100 sm:text-sm">Provedor de internet</p></div></div>
              <span aria-hidden="true" className="hidden h-12 w-px shrink-0 bg-sky-300/80 sm:block" />
              <div className="flex flex-1 items-center gap-3 text-xs leading-5 text-slate-100 sm:min-w-[180px] sm:text-sm"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white"><Check size={19} strokeWidth={3} aria-hidden="true" /></span><p>Este canal atende exclusivamente às unidades escolares contempladas com esse serviço.</p></div>
            </div>

            <p className="mt-3">Caso sua unidade escolar não seja contemplada com esse serviço, solicitamos que não utilize este canal para registrar solicitações relacionadas à conexão ou ao suporte técnico.</p>
          </section>

          <div className="mx-auto mt-4 flex w-full max-w-[610px] flex-col gap-3 sm:flex-row sm:gap-4">
            <Link to="/internet-escolas" replace={false} state={{ startInternetService: true }} className="flex min-h-[52px] flex-1 items-center justify-center gap-3 rounded-full border border-blue-400/60 bg-gradient-to-b from-[#13b7f8] to-[#0753d6] px-5 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(0,126,255,0.4)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"><LogIn size={20} aria-hidden="true" /> ENTRAR E CONTINUAR <ChevronRight size={18} aria-hidden="true" /></Link>
            <button type="button" aria-expanded={moreOpen} aria-controls="internet-canal-mais" onClick={() => setMoreOpen(value => !value)} className="flex min-h-[52px] items-center justify-center gap-3 rounded-full border border-sky-400 bg-[#00132f] px-8 py-3 text-sm font-bold text-white shadow-[0_0_12px_rgba(56,189,248,0.2)] transition hover:bg-[#0b2b54] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 sm:min-w-[225px]"><Info size={20} aria-hidden="true" /> SAIBA MAIS</button>
          </div>

          {moreOpen && <section id="internet-canal-mais" aria-labelledby="internet-canal-mais-title" className="mx-auto mt-4 max-w-[720px] rounded-2xl border border-[#1b4e87] bg-[#08244b] p-4 text-sm leading-6 text-slate-200"><h2 id="internet-canal-mais-title" className="font-bold text-white">Sobre este canal</h2><p className="mt-2">Este espaço é destinado às unidades da Rede Municipal de Ensino atendidas pelo serviço de internet disponibilizado pela SEMEC por meio da ONLINE TELECOM.</p><p className="mt-2">O gestor informa o problema pelo atendimento guiado. A CTEC verifica a solicitação e, quando necessário, a encaminha ao suporte do provedor.</p><p className="mt-2">Se tiver dúvida sobre a cobertura da sua unidade, confirme com a equipe da CTEC antes de registrar uma solicitação.</p></section>}

          <footer className="mt-5 flex items-center justify-center gap-3 text-center text-xs leading-5 text-slate-200 sm:gap-7"><span aria-hidden="true" className="hidden h-px flex-1 bg-[#174277] sm:block"/><div><p className="italic">Agradecemos a compreensão e a colaboração de todos!</p><p className="mt-1 font-bold text-white">CTEC – Coordenação de Tecnologia Educacional</p><p className="text-blue-100">Secretaria Municipal de Educação – SEMEC Abaetetuba.</p></div><span aria-hidden="true" className="hidden h-px flex-1 bg-[#174277] sm:block"/></footer>
        </div>
      </div>
    </main>
  );
}
