import { Inbox } from 'lucide-react';

export default function EmptyState({ title = 'Nenhum registro', description = 'Não há dados para exibir.', icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
        <Icon className="text-slate-400" size={28} />
      </div>
      <p className="font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
