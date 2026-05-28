import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, MonitorSmartphone, School, Users,
  BarChart3, Wrench, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'tecnico', 'atendente'] },
  { to: '/ordens', label: 'Ordens de Serviço', icon: ClipboardList, roles: ['admin', 'tecnico', 'atendente'] },
  { to: '/equipamentos', label: 'Equipamentos', icon: Wrench, roles: ['admin', 'tecnico'] },
  { to: '/escolas', label: 'Escolas', icon: School, roles: ['admin', 'tecnico', 'atendente'] },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, roles: ['admin', 'tecnico'] },
  { to: '/usuarios', label: 'Usuários', icon: Users, roles: ['admin'] },
  { to: '/laboratorios', label: 'Laboratórios', icon: MonitorSmartphone, roles: ['admin', 'tecnico'] }
];

/**
 * Sidebar compacta (rail) com balão popup ao passar o mouse em cada ícone.
 * O balão flutua ao lado direito do ícone, com seta indicativa, sombra
 * pronunciada e animação de pop-in (escala + fade).
 */
export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-slate-900/60 z-30 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed lg:sticky lg:top-0 z-40 left-0 h-screen
          bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800
          transition-transform duration-200
          w-72 lg:w-[72px]
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          shadow-xl lg:shadow-none
          /* deixa overflow visível em desktop para o balão aparecer pra fora */
          overflow-y-auto lg:overflow-visible`}
      >
        {/* Header */}
        <div className="flex items-center justify-between lg:justify-center h-16 border-b border-slate-200 dark:border-slate-800 px-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-soft">
        <div className="w-10 h-10 shrink-0 rounded-xl overflow-hidden bg-white shadow-soft flex items-center justify-center">
  <img
    src="/L1.png"
    alt="Logo"
    className="w-full h-full object-cover"
  />
</div>
            </div>
            <div className="lg:hidden">
              <p className="font-bold text-slate-900 dark:text-white leading-tight">O.S. SEMEC</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Abaetetuba — T.I.</p>
            </div>
          </div>
          <button className="lg:hidden btn-ghost p-1.5" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Nav — overflow visível para mostrar balão lateral */}
        <nav className="p-2 space-y-1.5">
          {items
            .filter((i) => !i.roles || i.roles.includes(user?.role))
            .map((it) => {
              const Icon = it.icon;
              return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `group/item relative flex items-center gap-3 h-11 rounded-xl text-sm font-medium transition-colors
                     px-3 lg:justify-center
                     ${isActive
                       ? 'bg-brand-600 text-white shadow-soft'
                       : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`
                  }
                >
                  <Icon size={20} className="shrink-0" />

                  {/* Label visível só no mobile (drawer aberto) */}
                  <span className="lg:hidden whitespace-nowrap">{it.label}</span>

                  {/* === BALÃO POPUP (desktop) === */}
                  <span
                    className="hidden lg:block pointer-events-none
                               absolute left-full top-1/2 -translate-y-1/2 ml-4
                               px-4 py-2.5 rounded-xl
                               bg-gradient-to-br from-slate-900 to-slate-800
                               dark:from-slate-700 dark:to-slate-800
                               text-white text-sm font-semibold whitespace-nowrap
                               shadow-2xl shadow-slate-900/40
                               ring-1 ring-white/10
                               opacity-0 scale-90 -translate-x-2
                               group-hover/item:opacity-100 group-hover/item:scale-100 group-hover/item:translate-x-0
                               transition-all duration-200 ease-out
                               z-[60]
                               /* setinha do balão apontando para o ícone */
                               before:content-[''] before:absolute before:top-1/2 before:-translate-y-1/2
                               before:right-full before:border-[7px] before:border-transparent
                               before:border-r-slate-900 dark:before:border-r-slate-700"
                  >
                    {it.label}
                  </span>
                </NavLink>
              );
            })}
        </nav>
      </aside>
    </>
  );
}