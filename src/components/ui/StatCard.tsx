import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  tone?: 'amber' | 'emerald' | 'red' | 'slate';
  footnote?: string;
}

const TONE_CLASS = {
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-700',
};

export function StatCard({ label, value, unit, icon: Icon, tone = 'slate', footnote }: StatCardProps) {
  return (
    <div className="glass-panel group p-5 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {value}
            {unit && <span className="ml-1 text-base font-semibold text-slate-500">{unit}</span>}
          </p>
          {footnote && <p className="mt-1 text-xs text-slate-500">{footnote}</p>}
        </div>
        <span className={`rounded-xl p-2.5 transition group-hover:scale-110 ${TONE_CLASS[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}
