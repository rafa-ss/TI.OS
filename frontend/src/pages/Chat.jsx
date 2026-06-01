import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Send, Users, Search } from 'lucide-react';
import api from '../services/api';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL } from '../utils/format';


// Formata data para apenas "HH:MM" (24h)
function formatHourMinute(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function Chat() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [general, setGeneral] = useState({ unread: 0 });
  const location = useLocation();
  const navigate = useNavigate();
  // Pega o contato vindo de outra tela (ex.: clicou em "Mensagens recentes" no dashboard)
  const [active, setActive] = useState(location.state?.activeContact || 'general');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const endRef = useRef(null);

  const loadContacts = useCallback(async () => {
    try {
      const { data } = await api.get('/chat/contacts');
      setContacts(data.contacts);
      setGeneral(data.general);
    } catch { /* ignore */ }
  }, []);

  const loadMessages = useCallback(async () => {
    if (!active) return;
    try {
      const { data } = await api.get('/chat/messages', { params: { with: active } });
      setMessages(data.items);
      // marca como lida
      await api.post('/chat/read', { with: active });
      loadContacts();
    } catch { /* ignore */ }
  }, [active, loadContacts]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  // Ping de presença (marca como online) a cada 30s
  useEffect(() => {
    const ping = () => api.post('/chat/presence').catch(() => {});
    ping();
    const t = setInterval(ping, 30000);
    return () => clearInterval(t);
  }, []);

  // Se navegou pra cá já indicando um contato, abre direto + limpa o state
  useEffect(() => {
    if (location.state?.activeContact) {
      setActive(location.state.activeContact);
      // limpa o state pra não reabrir se o usuário navegar de novo
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line
  }, [location.state]);

  useEffect(() => {
    loadMessages();
    const t = setInterval(loadMessages, 15000); // refresh a cada 15s
    return () => clearInterval(t);
  }, [loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send(e) {
    e?.preventDefault();
    if (!text.trim()) return;
    try {
      await api.post('/chat/messages', { to: active, text: text.trim() });
      setText('');
      loadMessages();
    } catch { /* ignore */ }
  }

  const filtered = contacts.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const activeContact = active === 'general'
    ? { name: 'Canal Geral', role: '', icon: Users }
    : contacts.find(c => c._id === active);

  return (
    <div className="card overflow-hidden h-[calc(100vh-140px)] flex">
      {/* Sidebar de contatos */}
      <aside className="w-72 border-r border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
            <MessageCircle size={18} className="text-pref-azul-600"/> Chat da equipe
          </h2>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400"/>
            <input className="input pl-8 !py-1.5 text-sm" placeholder="Buscar..."
              value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Canal geral */}
          <ContactItem
            name="Canal Geral"
            sub="Todos os membros"
            unread={general.unread}
            active={active === 'general'}
            iconColor="bg-pref-vermelho-500"
            isGeneral
            onClick={() => setActive('general')}
          />

          {/* Lista de pessoas */}
          {filtered.map(c => (
            <ContactItem
              key={c._id}
              name={c.name}
              sub={ROLE_LABEL[c.role] || c.role}
              unread={c.unread}
              active={active === c._id}
              iconColor={
                c.role === 'admin' ? 'bg-pref-vermelho-500'
                : c.role === 'tecnico' ? 'bg-pref-azul-500'
                : 'bg-pref-amarelo-500'
              }
              onClick={() => setActive(c._id)}
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-4">Nenhum contato</p>
          )}
        </div>
      </aside>

      {/* Área de mensagens */}
      <section className="flex-1 flex flex-col min-w-0">
        {/* Header da conversa */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          {active === 'general'
            ? <div className="w-9 h-9 rounded-full bg-pref-vermelho-500 text-white flex items-center justify-center font-bold">
                {(activeContact?.name || '?').charAt(0).toUpperCase()}
              </div>
            : <Avatar src={activeContact?.avatarUrl} name={activeContact?.name} role={activeContact?.role} size={36}/>}
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{activeContact?.name || '—'}</p>
            {activeContact?.role && (
              <p className="text-xs text-slate-500">{ROLE_LABEL[activeContact.role] || activeContact.role}</p>
            )}
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 dark:bg-slate-950/50 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-sm text-slate-500 mt-10">
              Nenhuma mensagem ainda. Comece a conversa! 👋
            </p>
          )}
          {messages.map(m => {
            const mine = m.from?._id === user?._id;
            return (
              <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-2xl px-3 py-1.5 ${
                  mine
                    ? 'bg-pref-azul-600 text-white rounded-br-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm shadow-sm'
                }`}>
                  {!mine && (
                    <p className="text-[11px] font-semibold text-pref-azul-600 dark:text-pref-azul-300">
                      {m.from?.name}
                    </p>
                  )}
                  {/* Texto + hora lado a lado (hora à direita, formato HH:MM) */}
                  <div className="flex items-end gap-2">
                    <p className="text-sm whitespace-pre-wrap break-words flex-1">{m.text}</p>
                    <span className={`text-[10px] shrink-0 leading-none pb-0.5 ${
                      mine ? 'text-white/70' : 'text-slate-400'
                    }`}>
                      {formatHourMinute(m.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef}/>
        </div>

        {/* Input */}
        <form onSubmit={send} className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
          <input
            className="input"
            placeholder={`Mensagem ${active === 'general' ? 'para todos' : 'para ' + (activeContact?.name || '')}...`}
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <button type="submit" disabled={!text.trim()} className="btn-primary">
            <Send size={16}/> Enviar
          </button>
        </form>
      </section>
    </div>
  );
}

function ContactItem({ name, sub, unread, active, iconColor, onClick, avatarUrl, role, online, isGeneral }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 text-left transition ${
        active
          ? 'bg-pref-azul-50 dark:bg-pref-azul-900/20 border-l-4 border-l-pref-azul-600'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
      }`}
    >
      <div className="relative shrink-0">
        {isGeneral
          ? <div className={`w-9 h-9 rounded-full text-white flex items-center justify-center font-bold ${iconColor || 'bg-pref-vermelho-500'}`}>
              {name.charAt(0).toUpperCase()}
            </div>
          : <Avatar src={avatarUrl} name={name} role={role} size={36}/>}
        {!isGeneral && online !== undefined && (
          <span
            title={online ? 'Online' : 'Offline'}
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-900 ${
              online ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{name}</p>
        {sub && <p className="text-xs text-slate-500 truncate">{sub}</p>}
      </div>
      {unread > 0 && (
        <span className="bg-pref-vermelho-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}