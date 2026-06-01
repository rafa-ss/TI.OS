import { Menu, Moon, Sun, LogOut, User } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import NotificationsDropdown from '../components/NotificationsDropdown';
import Avatar from '../components/Avatar';
import { ROLE_LABEL } from '../utils/format';

export default function Navbar({ onMenu }) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setMenu(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/85 dark:bg-slate-900/85 backdrop-blur border-b border-slate-200 dark:border-slate-800">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button className="lg:hidden btn-ghost p-2" onClick={onMenu}>
            <Menu size={20} />
          </button>
          <div className="hidden md:block">
            <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Sistema de Ordens de Serviço
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Secretaria Municipal de Educação de Abaetetuba — T.I.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <NotificationsDropdown />
          <button onClick={toggle} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div className="relative" ref={ref}>
            <button
              onClick={() => setMenu((o) => !o)}
              className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Avatar src={user?.avatarUrl} name={user?.name} role={user?.role} size={32}/>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-tight">{user?.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{ROLE_LABEL[user?.role]}</p>
              </div>
            </button>
            {menu && (
              <div className="absolute right-0 mt-2 w-56 card z-30">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <Avatar src={user?.avatarUrl} name={user?.name} role={user?.role} size={40}/>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setMenu(false); navigate('/perfil'); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <User size={16} /> Meu perfil
                </button>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                >
                  <LogOut size={16} /> Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
