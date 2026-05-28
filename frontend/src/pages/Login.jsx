import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Lock, Mail, Loader2, BookOpen, Monitor, GraduationCap, Cpu,
  Code2, Mouse, Wifi, Lightbulb, Calculator, Globe, Keyboard
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@semed.abaetetuba.pa.gov.br');
  const [password, setPassword] = useState('Admin@123');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Bem-vindo(a)!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center p-4
                    bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">

      {/* ===== Camada 1: grade tecnológica ===== */}
      <div className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59,130,246,.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,.4) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}/>

      {/* ===== Camada 2: padrão de circuitos SVG ===== */}
      <svg className="absolute inset-0 w-full h-full opacity-20" aria-hidden="true">
        <defs>
          <pattern id="circuit" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="#60a5fa" strokeWidth="1.2">
              <path d="M10 50 L70 50 L70 100 L130 100 L130 30 L190 30"/>
              <path d="M10 150 L50 150 L50 110 L100 110"/>
              <path d="M150 180 L150 130 L110 130"/>
              <circle cx="70" cy="50" r="3" fill="#60a5fa"/>
              <circle cx="130" cy="100" r="3" fill="#60a5fa"/>
              <circle cx="50" cy="110" r="3" fill="#60a5fa"/>
              <circle cx="150" cy="130" r="3" fill="#60a5fa"/>
              <circle cx="190" cy="30" r="3" fill="#60a5fa"/>
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#circuit)"/>
      </svg>

      {/* ===== Camada 3: orbes coloridos desfocados ===== */}
      <div className="absolute top-20 -left-32 w-96 h-96 rounded-full bg-blue-500/20 blur-[120px]"/>
      <div className="absolute bottom-10 -right-32 w-96 h-96 rounded-full bg-cyan-500/20 blur-[120px]"/>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[140px]"/>

      {/* ===== Camada 4: ícones flutuantes decorativos ===== */}
      <FloatingIcon Icon={BookOpen}        className="top-[10%]  left-[8%]"  size={42} delay="0s"  />
      <FloatingIcon Icon={Monitor}         className="top-[18%]  right-[12%]" size={50} delay="1.2s"/>
      <FloatingIcon Icon={GraduationCap}   className="top-[68%]  left-[6%]"  size={48} delay="0.6s"/>
      <FloatingIcon Icon={Cpu}             className="bottom-[14%] right-[10%]" size={44} delay="1.8s"/>
      <FloatingIcon Icon={Code2}           className="top-[35%]  left-[3%]"  size={36} delay="2.4s"/>
      <FloatingIcon Icon={Mouse}           className="top-[45%]  right-[6%]" size={34} delay="0.9s"/>
      <FloatingIcon Icon={Wifi}            className="bottom-[28%] left-[14%]" size={40} delay="1.5s"/>
      <FloatingIcon Icon={Lightbulb}       className="top-[8%]   right-[35%]" size={32} delay="2.1s"/>
      <FloatingIcon Icon={Calculator}      className="bottom-[8%] left-[40%]" size={36} delay="0.3s"/>
      <FloatingIcon Icon={Globe}           className="top-[55%]  right-[28%]" size={38} delay="2.7s"/>
      <FloatingIcon Icon={Keyboard}        className="bottom-[35%] right-[40%]" size={34} delay="1.6s"/>

      {/* ===== Camada 5: binários flutuando (textinhos sutis) ===== */}
      <BinaryText className="top-[25%]  left-[20%]">01001000</BinaryText>
      <BinaryText className="top-[75%]  right-[20%]">10110101</BinaryText>
      <BinaryText className="top-[5%]   left-[45%]">11001010</BinaryText>
      <BinaryText className="bottom-[5%] right-[30%]">00101101</BinaryText>

      {/* ===== Animação keyframes inline ===== */}
      <style>{`
        @keyframes float {
          0%,100% { transform: translateY(0) rotate(0); }
          50%     { transform: translateY(-14px) rotate(3deg); }
        }
        @keyframes pulseSoft {
          0%,100% { opacity: .25; }
          50%     { opacity: .55; }
        }
      `}</style>

      {/* ===== Card do login (sobre as camadas) ===== */}
      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-md p-8 sm:p-10
                   bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl
                   rounded-2xl shadow-2xl shadow-blue-900/50
                   ring-1 ring-white/20"
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-slate-200 dark:ring-slate-700">
            <img src="/logo-lg.png" alt="CTEC" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Cabeçalho */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bem-vindo(a)!</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            SEMEC Abaetetuba — Sistema de O.S.
          </p>
        </div>

        {/* Campos */}
        <div className="space-y-4">
          <div>
            <label className="label">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input pl-10"
                placeholder="seu@email.gov.br"
              />
            </div>
          </div>

          <div>
            <label className="label">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pl-10"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Entrar'}
          </button>
        </div>

        <p className="mt-6 text-xs text-slate-500 dark:text-slate-400 text-center">
          Acesso restrito à equipe de T.I. da SEMEC.
        </p>
      </form>
    </div>
  );
}

// ===== Componentes auxiliares =====
function FloatingIcon({ Icon, className = '', size = 40, delay = '0s' }) {
  return (
    <div
      className={`absolute text-blue-400/30 dark:text-blue-300/30 pointer-events-none ${className}`}
      style={{
        animation: `float 6s ease-in-out infinite, pulseSoft 4s ease-in-out infinite`,
        animationDelay: delay,
      }}
    >
      <Icon size={size} strokeWidth={1.5}/>
    </div>
  );
}

function BinaryText({ children, className = '' }) {
  return (
    <span
      className={`absolute font-mono text-blue-300/20 text-sm tracking-widest pointer-events-none select-none ${className}`}
      style={{ animation: 'pulseSoft 5s ease-in-out infinite' }}
    >
      {children}
    </span>
  );
}