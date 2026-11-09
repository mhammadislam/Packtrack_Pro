import { CheckCircle2, ClipboardList, Gauge, ShieldX } from 'lucide-react';
import type { QcReport } from '@/lib/qc';
import { formatNumber } from '@/lib/dates';

interface QcStatsProps {
  reports: QcReport[];
}

export function QcStats({ reports }: QcStatsProps) {
  const total = reports.length;
  const approved = reports.filter((report) => report.status === 'Approved').length;
  const rejected = reports.filter((report) => report.grade === 'Rejected').length;
  const avgDefect = total === 0 ? 0 : reports.reduce((sum, report) => sum + report.defect_pct, 0) / total;
  const approvalRate = total === 0 ? 0 : (approved / total) * 100;

  const cards = [
    { label: 'Reports in range', value: formatNumber(total), footnote: 'QC checks logged', icon: ClipboardList, tone: 'text-sky-700 bg-sky-100' },
    { label: 'Approval rate', value: `${approvalRate.toFixed(1)}%`, footnote: `${approved} approved`, icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-100' },
    { label: 'Average defect', value: `${avgDefect.toFixed(2)}%`, footnote: 'Across all samples', icon: Gauge, tone: 'text-amber-700 bg-amber-100' },
    { label: 'Rejected batches', value: formatNumber(rejected), footnote: 'Defect rate above 5%', icon: ShieldX, tone: 'text-red-700 bg-red-100' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, footnote, icon: Icon, tone }) => (
        <div key={label} className="glass-panel group p-5 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
              <p className="mt-1 text-xs text-slate-500">{footnote}</p>
            </div>
            <span className={`rounded-xl p-2.5 ${tone}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
