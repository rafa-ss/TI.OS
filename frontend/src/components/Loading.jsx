import { Loader2 } from 'lucide-react';

export function Spinner({ size = 24, className = '' }) {
  return <Loader2 className={`animate-spin ${className}`} size={size} />;
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size={32} className="text-brand-600" />
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((__, j) => (
            <div key={j} className="skeleton h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
