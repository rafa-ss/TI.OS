import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const go = (p) => p >= 1 && p <= totalPages && onChange(p);

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between p-3 text-sm">
      <div className="text-slate-500 dark:text-slate-400">
        Página <span className="font-semibold text-slate-700 dark:text-slate-200">{page}</span> de {totalPages}
      </div>
      <div className="flex items-center gap-1">
        <button className="btn-ghost p-1.5" onClick={() => go(page - 1)} disabled={page === 1}>
          <ChevronLeft size={16} />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => go(p)}
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              p === page
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {p}
          </button>
        ))}
        <button className="btn-ghost p-1.5" onClick={() => go(page + 1)} disabled={page === totalPages}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
