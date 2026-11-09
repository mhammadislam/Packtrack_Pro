import type { KeyboardEvent } from 'react';
import { formatDate } from '@/lib/dates';
import { QcGradeBadge, QcStatusBadge } from '@/components/qc/QcBadges';
import type { QcReport } from '@/lib/qc';

interface QcReportTableProps {
  reports: QcReport[];
  onOpen: (report: QcReport) => void;
}

const ROW_TONE: Record<QcReport['status'], string> = {
  Approved: 'bg-emerald-50 hover:bg-emerald-100/70 [&>td:first-child]:border-l-emerald-500',
  Hold: 'hover:bg-slate-50 [&>td:first-child]:border-l-amber-500',
  Rejected: 'bg-red-50/60 hover:bg-red-50 [&>td:first-child]:border-l-red-500',
};

const HEADERS = ['Report No', 'Date', 'Customer', 'Job Card', 'Machine', 'Operator', 'Defect %', 'Grade', 'Status'];

export function QcReportTable({ reports, onOpen }: QcReportTableProps) {
  if (reports.length === 0) {
    return <p className="py-16 text-center text-sm text-slate-500">No QC reports match these filters.</p>;
  }

  const handleKey = (event: KeyboardEvent<HTMLTableRowElement>, report: QcReport) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(report);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.14em] text-slate-500">
            {HEADERS.map((header) => (
              <th key={header} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr
              key={report.id}
              tabIndex={0}
              onClick={() => onOpen(report)}
              onKeyDown={(event) => handleKey(event, report)}
              className={`cursor-pointer border-b border-slate-100 text-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 [&>td:first-child]:border-l-2 [&>td:first-child]:border-l-transparent ${ROW_TONE[report.status]}`}
            >
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{report.report_no}</td>
              <td className="whitespace-nowrap px-4 py-3">{formatDate(report.report_date)}</td>
              <td className="max-w-[180px] truncate px-4 py-3">{report.customer_name}</td>
              <td className="whitespace-nowrap px-4 py-3">{report.job_card_no}</td>
              <td className="whitespace-nowrap px-4 py-3">{report.machine_no}</td>
              <td className="whitespace-nowrap px-4 py-3">{report.operator_name}</td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">{report.defect_pct.toFixed(2)}%</td>
              <td className="whitespace-nowrap px-4 py-3">
                <QcGradeBadge grade={report.grade} />
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <QcStatusBadge status={report.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
