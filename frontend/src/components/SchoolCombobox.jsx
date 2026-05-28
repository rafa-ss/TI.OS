import { useEffect, useRef, useState } from 'react';
import { Search, School as SchoolIcon, Check, X } from 'lucide-react';
import api from '../services/api';

/**
 * Combobox autocompletável de Escola.
 * Funde "buscar" e "selecionar" em um único campo:
 *  - O usuário digita -> a lista filtra em tempo real (debounce 250ms)
 *  - Clica num item -> seleciona e fecha
 *  - Mostra a escola selecionada com botão de limpar
 *
 * Props:
 *  - value: id da escola selecionada (string)
 *  - onChange(id): callback ao selecionar/limpar
 *  - placeholder
 */
export default function SchoolCombobox({ value, onChange, placeholder = 'Buscar escola por nome ou INEP...' }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const ref = useRef(null);

  // Carrega dados da escola já selecionada (se houver value)
  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected && selected._id === value) return;
    api.get(`/schools/${value}`)
      .then(r => setSelected(r.data.school))
      .catch(() => setSelected(null));
    // eslint-disable-next-line
  }, [value]);

  // Debounce de busca
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => {
      api.get('/schools/options', { params: { q: query } })
        .then(r => { setOptions(r.data.items || []); setActiveIdx(0); })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  // Fecha ao clicar fora
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function selectItem(opt) {
    setSelected(opt);
    onChange?.(opt._id);
    setQuery('');
    setOpen(false);
  }

  function clear() {
    setSelected(null);
    onChange?.('');
    setQuery('');
  }

  function onKeyDown(e) {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, options.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); if (options[activeIdx]) selectItem(options[activeIdx]); }
    if (e.key === 'Escape')    { setOpen(false); }
  }

  return (
    <div className="relative" ref={ref}>
      {/* Mostra chip da escola selecionada */}
      {selected ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800">
          <SchoolIcon size={16} className="text-emerald-600 shrink-0"/>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{selected.name}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">INEP {selected.inep} · {selected.municipio}</p>
          </div>
          <button type="button" onClick={clear} className="btn-ghost p-1 text-rose-500" title="Trocar escola">
            <X size={16}/>
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none"/>
            <input
              type="text"
              className="input pl-9"
              placeholder={placeholder}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
            />
          </div>

          {open && (
            <div className="absolute z-30 mt-1 w-full card max-h-72 overflow-y-auto shadow-xl">
              {loading && (
                <p className="text-xs text-slate-500 px-4 py-3">Buscando...</p>
              )}
              {!loading && options.length === 0 && (
                <p className="text-sm text-slate-500 px-4 py-3">Nenhuma escola encontrada.</p>
              )}
              {!loading && options.map((opt, i) => (
                <button
                  key={opt._id}
                  type="button"
                  onClick={() => selectItem(opt)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`w-full text-left flex items-start gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0
                    ${i === activeIdx ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <SchoolIcon size={16} className="text-brand-600 mt-0.5 shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{opt.name}</p>
                    <p className="text-[11px] text-slate-500">INEP {opt.inep} · {opt.municipio}</p>
                  </div>
                  {i === activeIdx && <Check size={14} className="text-brand-600 mt-1"/>}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
