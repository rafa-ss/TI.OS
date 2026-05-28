import { STATUS_LABEL, STATUS_COLOR, PRIORITY_LABEL, PRIORITY_COLOR } from '../utils/format';

export function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_COLOR[status] || 'bg-slate-100 text-slate-700'}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  return (
    <span className={`badge ${PRIORITY_COLOR[priority] || 'bg-slate-100 text-slate-700'}`}>
      {PRIORITY_LABEL[priority] || priority}
    </span>
  );
}
