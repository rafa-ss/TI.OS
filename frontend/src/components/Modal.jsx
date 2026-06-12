import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`relative w-full ${sizes[size]} card
        max-h-[92vh] sm:max-h-[92vh] flex flex-col
        rounded-b-none sm:rounded-2xl`}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white pr-2">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg shrink-0">
            <X size={20} />
          </button>
        </div>
        <div className="px-4 sm:px-6 py-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-200 dark:border-slate-800
            flex flex-col-reverse sm:flex-row justify-end gap-2
            [&>button]:w-full sm:[&>button]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
