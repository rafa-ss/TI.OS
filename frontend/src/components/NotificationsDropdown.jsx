import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { formatDate } from '../utils/format';

export default function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  async function load() {
    try {
      const { data } = await api.get('/notifications');
      setItems(data.items || []);
      setUnread(data.unread || 0);
    } catch { /* silent */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function markAll() {
    await api.patch('/notifications/read-all');
    load();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-rose-500 text-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 card z-40">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Notificações</h3>
            <button onClick={markAll} className="text-xs flex items-center gap-1 text-brand-600 hover:underline">
              <CheckCheck size={14}/> marcar todas
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="text-sm text-center text-slate-500 py-8">Sem notificações</p>
            )}
            {items.map((n) => (
              <Link
                key={n._id}
                to={n.link || '#'}
                onClick={() => setOpen(false)}
                className={`block px-4 py-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${!n.read ? 'bg-brand-50/40 dark:bg-brand-900/10' : ''}`}
              >
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{n.title}</p>
                {n.message && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</p>}
                <p className="text-[10px] text-slate-400 mt-1">{formatDate(n.createdAt)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
