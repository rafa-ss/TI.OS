import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, MessageSquareOff } from 'lucide-react';
import api from '../services/api';
import Avatar from './Avatar';

/**
 * Caixa "Mensagens recentes" do Dashboard.
 * Mostra APENAS conversas já iniciadas (com pelo menos 1 mensagem trocada),
 * ordenadas pela mais recente. Inclui prévia da última mensagem e horário.
 *
 * Refresh automático a cada 20s.
 */
export default function RecentMessagesCard() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [general, setGeneral] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/chat/conversations');
      setConversations(data.conversations || []);
      setGeneral(data.general);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  function go(target) {
    navigate('/chat', { state: { activeContact: target } });
  }

  // Ordena: não-lidas primeiro, depois pela data mais recente
  const sorted = [...conversations].sort((a, b) => {
    if ((b.unread || 0) !== (a.unread || 0)) return (b.unread || 0) - (a.unread || 0);
    return new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0);
  });

  const totalUnread = (general?.unread || 0) +
    conversations.reduce((sum, c) => sum + (c.unread || 0), 0);

  const hasAnything = !!general || sorted.length > 0;

  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pref-azul-100 dark:bg-pref-azul-900/30 flex items-center justify-center">
            <MessageCircle size={16} className="text-pref-azul-600 dark:text-pref-azul-300"/>
          </div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Mensagens recentes</h3>
          {totalUnread > 0 && (
            <span className="bg-pref-vermelho-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/chat')}
          className="text-xs text-pref-azul-600 dark:text-pref-azul-300 hover:underline font-medium"
        >
          Abrir chat →
        </button>
      </div>

      <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[26rem] overflow-y-auto">
        {loading && (
          <li className="px-5 py-4 text-sm text-slate-500 text-center">Carregando...</li>
        )}

        {!loading && !hasAnything && (
          <li className="px-5 py-10 text-center">
            <MessageSquareOff size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2"/>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Nenhuma conversa ainda
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Inicie uma conversa em <button
                onClick={() => navigate('/chat')}
                className="text-pref-azul-600 hover:underline font-medium">Chat</button>
            </p>
          </li>
        )}

        {!loading && general && (
          <ConversationRow
            name="Canal Geral"
            iconColor="bg-pref-vermelho-500"
            unread={general.unread}
            lastMessage={general.lastMessage}
            generalAuthor={general.lastMessage?.fromName}
            onClick={() => go('general')}
          />
        )}

        {!loading && sorted.map((c) => (
          <ConversationRow
            key={c.contactId}
            name={c.name}
            avatarUrl={c.avatarUrl || ''}
            role={c.role}
            unread={c.unread}
            lastMessage={c.lastMessage}
            onClick={() => go(c.contactId)}
          />
        ))}
      </ul>
    </div>
  );
}

function ConversationRow({ name, iconColor, unread = 0, lastMessage, generalAuthor, onClick, avatarUrl, role }) {
  const hasUnread = unread > 0;
  const preview = lastMessage?.text || '';
  const prefix = generalAuthor
    ? `${generalAuthor}: `
    : lastMessage?.fromMe ? 'Você: ' : '';

  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-5 py-3 text-left transition ${
          hasUnread
            ? 'bg-pref-azul-50/50 dark:bg-pref-azul-900/10 hover:bg-pref-azul-100/60 dark:hover:bg-pref-azul-900/20'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }`}
      >
        <div className="relative shrink-0">
          {avatarUrl !== undefined && avatarUrl !== null
            ? <Avatar src={avatarUrl} name={name} role={role} size={40}/>
            : <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold ${iconColor}`}>
                {name.charAt(0).toUpperCase()}
              </div>}
          {hasUnread && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-pref-vermelho-500 ring-2 ring-white dark:ring-slate-900"/>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm truncate ${hasUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200'}`}>
              {name}
            </p>
            <span className="text-[10px] text-slate-400 shrink-0">
              {formatRelativeTime(lastMessage?.createdAt)}
            </span>
          </div>
          <p className={`text-xs truncate mt-0.5 ${hasUnread ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
            {prefix}{preview || <span className="italic">sem prévia</span>}
          </p>
        </div>

        {hasUnread && (
          <span className="bg-pref-vermelho-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shrink-0">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </li>
  );
}

/**
 * "agora", "5min", "2h", "ontem", "12/05"
 */
function formatRelativeTime(d) {
  if (!d) return '';
  const date = new Date(d);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'ontem';
  if (diffD < 7) return `${diffD}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
