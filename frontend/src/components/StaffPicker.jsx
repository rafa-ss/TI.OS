import { useEffect, useRef, useState } from 'react';

/**
 * Multi-seletor de membros da equipe (técnicos + admins).
 *
 * Props:
 *  - value:    array de IDs selecionados
 *  - options:  array de usuários { _id, name, role, email }
 *  - onChange: (ids[]) => void
 *  - excludeId: opcional — esconde esse usuário da lista (ex.: o técnico responsável)
 *  - placeholder
 */
export default function StaffPicker({ value = [], options = [], onChange, excludeId, placeholder = 'Clique para selecionar...' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function toggle(id) {
    if (value.includes(id)) onChange(value.filter(v => v !== id));
    else onChange([...value, id]);
  }

  const available = options.filter(o => o._id !== excludeId);
  const selectedItems = available.filter(o => value.includes(o._id));
  const filtered = available.filter(o =>
    !search || o.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="input min-h-[42px] flex flex-wrap items-center gap-1.5 text-left cursor-pointer"
      >
        {selectedItems.length === 0 ? (
          <span className="text-slate-400">{placeholder}</span>
        ) : (
          selectedItems.map(item => (
            <span
              key={item._id}
              className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs font-medium ${
                item.role === 'admin'
                  ? 'bg-pref-vermelho-100 text-pref-vermelho-700 dark:bg-pref-vermelho-900/40 dark:text-pref-vermelho-300'
                  : 'bg-pref-azul-100 text-pref-azul-700 dark:bg-pref-azul-900/40 dark:text-pref-azul-300'
              }`}
            >
              {item.role === 'admin' ? '👤' : '🔧'} {item.name}
              <span
                onClick={(e) => { e.stopPropagation(); toggle(item._id); }}
                className="ml-1 w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-white/40"
              >
                ×
              </span>
            </span>
          ))
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full card max-h-72 overflow-hidden flex flex-col shadow-xl">
          <div className="p-2 border-b border-slate-200 dark:border-slate-800">
            <input
              autoFocus
              className="input !py-1.5 text-sm"
              placeholder="Buscar pessoa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-sm text-slate-500 px-3 py-3 text-center">Nenhuma pessoa encontrada</p>
            )}
            {filtered.map(opt => {
              const checked = value.includes(opt._id);
              return (
                <button
                  key={opt._id}
                  type="button"
                  onClick={() => toggle(opt._id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                    checked
                      ? 'bg-pref-azul-50 dark:bg-pref-azul-900/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <input type="checkbox" checked={checked} onChange={() => {}} className="rounded pointer-events-none"/>
                  <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                    opt.role === 'admin'
                      ? 'bg-pref-vermelho-100 text-pref-vermelho-700 dark:bg-pref-vermelho-900/40 dark:text-pref-vermelho-300'
                      : 'bg-pref-azul-100 text-pref-azul-700 dark:bg-pref-azul-900/40 dark:text-pref-azul-300'
                  }`}>
                    {opt.role === 'admin' ? 'Admin' : 'Técnico'}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{opt.name}</span>
                  <span className="ml-auto text-[10px] text-slate-500">{opt.email}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
