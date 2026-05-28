import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Lock, Mail, Loader2, BookOpen, Monitor, GraduationCap, Cpu,
  Code2, Mouse, Wifi, Lightbulb, Calculator, Globe, Keyboard,
  Eye, EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const REMEMBER_KEY = 'os_remember_email';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Carrega só o e-mail (NUNCA a senha) se a pessoa marcou "lembrar"
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);

      // Salva ou remove conforme a escolha
      if (remember) localStorage.setItem(REMEMBER_KEY, email);
      else localStorage.removeItem(REMEMBER_KEY);

      toast.success('Bem-vindo(a)!');
      navigate('/');
    } catch (err) {
      // O backend retorna mensagens específicas:
      // - 401 com tempo de bloqueio quando ultrapassa 5 tentativas
      const msg = err.response?.data?.message || 'Falha no login';
      toast.error(msg, { duration: 4500 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center p-4
                    bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">

      {/* fundo decorativo */}
      <div className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `linear-gradient(rgba(59,130,246,.4) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(59,130,246,.4) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}/>
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
      <div className="absolute top-20 -left-32 w-96 h-96 rounded-full bg-blue-500/20 blur-[120px]"/>
      <div className="absolute bottom-10 -right-32 w-96 h-96 rounded-full bg-cyan-500/20 blur-[120px]"/>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[140px]"/>

      <FloatingIcon Icon={BookOpen}      className="top-[10%]  left-[8%]"   size={42} delay="0s"  />
      <FloatingIcon Icon={Monitor}       className="top-[18%]  right-[12%]" size={50} delay="1.2s"/>
      <FloatingIcon Icon={GraduationCap} className="top-[68%]  left-[6%]"   size={48} delay="0.6s"/>
      <FloatingIcon Icon={Cpu}           className="bottom-[14%] right-[10%]" size={44} delay="1.8s"/>
      <FloatingIcon Icon={Code2}         className="top-[35%]  left-[3%]"   size={36} delay="2.4s"/>
      <FloatingIcon Icon={Mouse}         className="top-[45%]  right-[6%]"  size={34} delay="0.9s"/>
      <FloatingIcon Icon={Wifi}          className="bottom-[28%] left-[14%]" size={40} delay="1.5s"/>
      <FloatingIcon Icon={Lightbulb}     className="top-[8%]   right-[35%]" size={32} delay="2.1s"/>
      <FloatingIcon Icon={Calculator}    className="bottom-[8%] left-[40%]" size={36} delay="0.3s"/>
      <FloatingIcon Icon={Globe}         className="top-[55%]  right-[28%]" size={38} delay="2.7s"/>
      <FloatingIcon Icon={Keyboard}      className="bottom-[35%] right-[40%]" size={34} delay="1.6s"/>

      <BinaryText className="top-[25%]  left-[20%]">01001000</BinaryText>
      <BinaryText className="top-[75%]  right-[20%]">10110101</BinaryText>
      <BinaryText className="top-[5%]   left-[45%]">11001010</BinaryText>
      <BinaryText className="bottom-[5%] right-[30%]">00101101</BinaryText>

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

      {/* CARD DE LOGIN */}
      <form
        onSubmit={onSubmit}
        autoComplete="off"
        className="relative z-10 w-full max-w-md p-8 sm:p-10
                   bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl
                   rounded-2xl shadow-2xl shadow-blue-900/50
                   ring-1 ring-white/20"
      >
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-slate-200 dark:ring-slate-700">
            <img src="/logo-lg.png" alt="CTEC" className="w-full h-full object-contain" />
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">CTEC</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            SEMEC Abaetetuba — Sistema de O.S.
          </p>
        </div>

        <div className="space-y-4">
          {/* E-mail */}
          <div>
            <label className="label">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input pl-10"
                placeholder="nome@ctec.com"
              />
            </div>
          </div>

          {/* Senha com olhinho */}
          <div>
            <label className="label">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pl-10 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-2 top-1.5 p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </div>
          </div>

          {/* Lembrar de mim */}
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500/40"
            />
            Lembrar meu e-mail neste computador
          </label>

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
