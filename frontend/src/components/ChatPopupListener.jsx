import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Faz polling de mensagens novas a cada 10s e mostra toast popup
 * no canto inferior direito. Cada mensagem aparece UMA vez por sessão
 * (controlado por Set local).
 * Os popups somem sozinhos após 8s ou quando o usuário clica em X.
 * Ao clicar no card, leva direto pro chat.
 */
export default function ChatPopupListener() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [popups, setPopups] = useState([]);
  const seenRef = useRef(new Set());
  const lastCheckRef = useRef(new Date(Date.now() - 60 * 1000).toISOString());

  useEffect(() => {
    if (!user) return;

    let cancel = false;
    async function check() {
      try {
        const { data } = await api.get('/chat/unread', { params: { since: lastCheckRef.current } });
        if (cancel) return;
        const novos = (data.items || []).filter(m => !seenRef.current.has(m._id));
        if (novos.length > 0) {
          novos.forEach(m => seenRef.current.add(m._id));
          // Não mostra popup se já estiver no chat
          if (!location.pathname.startsWith('/chat')) {
            setPopups(prev => [...novos.reverse(), ...prev].slice(0, 4));
            // Auto-dismiss após 8s
            novos.forEach(m => {
              setTimeout(() => {
                setPopups(prev => prev.filter(p => p._id !== m._id));
              }, 8000);
            });
          }
        }
        lastCheckRef.current = new Date().toISOString();
      } catch { /* ignore */ }
    }

    check();
    const t = setInterval(check, 30000); // 30s
    return () => { cancel = true; clearInterval(t); };
  }, [user, location.pathname]);

  function dismiss(id) {
    setPopups(prev => prev.filter(p => p._id !== id));
  }
  function open(msg) {
    const to = msg.to ? msg.from._id : 'general';
    navigate('/chat', { state: { activeContact: to } });
    setPopups([]);
  }

  if (popups.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2 max-w-sm pointer-events-none">
      {popups.map(m => (
        <div
          key={m._id}
          onClick={() => open(m)}
          className="pointer-events-auto cursor-pointer
                     bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-pref-azul-900/30
                     border-l-4 border-l-pref-azul-600
                     p-4 pr-10 relative
                     animate-[slideUp_.3s_ease-out]
                     hover:shadow-pref-azul-900/50 transition"
          style={{ animation: 'slideUp .3s ease-out' }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); dismiss(m._id); }}
            className="absolute top-2 right-2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Fechar"
          >
            <X size={14}/>
          </button>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-pref-azul-600 text-white flex items-center justify-center font-bold shrink-0">
              {(m.from?.name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-pref-azul-600 dark:text-pref-azul-300 font-semibold flex items-center gap-1">
                <MessageCircle size={12}/>
                {m.from?.name}
                {!m.to && <span className="text-[10px] bg-pref-vermelho-100 text-pref-vermelho-700 px-1.5 rounded">geral</span>}
              </p>
              <p className="text-sm text-slate-800 dark:text-slate-100 line-clamp-2 mt-0.5">{m.text}</p>
              <p className="text-[10px] text-slate-400 mt-1">Clique para abrir o chat</p>
            </div>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
