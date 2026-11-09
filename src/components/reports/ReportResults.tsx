import { useMemo, useState } from 'react';
import { Activity, FileSpreadsheet, FileText, Gauge, PackageCheck, Scale, Trash2 } from 'lucide-react';
import { DEPARTMENT_BY_CODE } from '@/lib/constants';
import type { ReportSummaryItem } from '@/lib/exports';
import { formatDate, formatNumber } from '@/lib/dates';
import { sumEntries, type EntryTotals } from '@/lib/analytics';
import type { ResolvedReport } from '@/lib/reports';
import type { ProductionEntry } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { Pagination } from '@/components/ui/Pagination';

const PAGE_SIZE = 10;

interface ReportResultsProps {
  report: ResolvedReport;
  rows: ProductionEntry[];
}

function breakdownKey(entry: ProductionEntry, by: ResolvedReport['breakdownBy']): string {
  return by === 'department' ? DEPARTMENT_BY_CODE[entry.department].shortName : entry.operator_name;
}

export function ReportResults({ report, rows }: ReportResultsProps) {
  const [page, setPage] = useState(1);

  const totals = useMemo(() => sumEntries(rows), [rows]);

  const breakdown = useMemo(() => {
    const groups = new Map<string, ProductionEntry[]>();
    for (const entry of rows) {
      const key = breakdownKey(entry, report.breakdownBy);
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return [...groups.entries()]
      .map(([label, entries]) => ({ label, totals: sumEntries(entries) }))
      .sort((a, b) => b.totals.qtyKg - a.totals.qtyKg);
  }, [rows, report.breakdownBy]);

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const summary: ReportSummaryItem[] = [
    { label: 'Entries', value: String(totals.count) },
    { label: 'Production (KG)', value: formatNumber(totals.qtyKg, 3) },
    { label: 'Production (Meters)', value: formatNumber(totals.qtyMeters) },
    { label: 'Wastage (KG)', value: formatNumber(totals.wastageKg, 3) },
    { label: 'Wastage %', value: `${totals.wastagePct.toFixed(2)}%` },
  ];

  const hasRows = rows.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold tracking-tight text-slate-900">{report.title}</h2>
          <p className="text-sm text-slate-500">{report.subtitle}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            disabled={!hasRows}
            onClick={() => void import('@/lib/exports').then(({ exportReportToExcel }) => exportReportToExcel({ ...report, rows, summary }))}
            icon={<FileSpreadsheet className="h-4 w-4 text-emerald-700" />}
          >
            Export Excel
          </Button>
          <Button
            variant="secondary"
            disabled={!hasRows}
            onClick={() => void import('@/lib/exports').then(({ exportReportToPdf }) => exportReportToPdf({ ...report, rows, summary }))}
            icon={<FileText className="h-4 w-4 text-red-700" />}
          >
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Production" value={formatNumber(totals.qtyKg, 1)} unit="KG" icon={PackageCheck} tone="emerald" footnote={`${formatNumber(totals.qtyMeters)} m`} />
        <StatCard label="Wastage" value={formatNumber(totals.wastageKg, 1)} unit="KG" icon={Trash2} tone="red" footnote={`${totals.wastagePct.toFixed(2)}% of processed`} />
        <StatCard label="Entries" value={String(totals.count)} icon={Activity} tone="amber" footnote="Production records in range" />
        <StatCard label="Net Output" value={formatNumber(totals.qtyKg - totals.wastageKg, 1)} unit="KG" icon={Scale} tone="slate" footnote="Production minus wastage" />
      </div>

      {hasRows ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
            <Gauge className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-800">
              {report.breakdownBy === 'department' ? 'Breakdown by department' : 'Breakdown by operator'}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{report.breakdownBy === 'department' ? 'Department' : 'Operator'}</th>
                  <th className="px-4 py-3 text-right">Entries</th>
                  <th className="px-4 py-3 text-right">Prod. KG</th>
                  <th className="px-4 py-3 text-right">Meters</th>
                  <th className="px-4 py-3 text-right">Wastage KG</th>
                  <th className="px-4 py-3 text-right">Wastage %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {breakdown.map((group) => (
                  <BreakdownRow key={group.label} label={group.label} totals={group.totals} />
                ))}
              </tbody>
              <tfoot className="bg-slate-900 text-sm font-semibold text-white">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{totals.count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(totals.qtyKg, 2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(totals.qtyMeters)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(totals.wastageKg, 2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{totals.wastagePct.toFixed(2)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Date</th>
                <th className="whitespace-nowrap px-4 py-3">Department</th>
                <th className="whitespace-nowrap px-4 py-3">Shift</th>
                <th className="whitespace-nowrap px-4 py-3">Operator</th>
                <th className="whitespace-nowrap px-4 py-3">Machine</th>
                <th className="whitespace-nowrap px-4 py-3">Job / Customer</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">KG</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Meters</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Wastage KG</th>
                <th className="whitespace-nowrap px-4 py-3">Downtime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-14 text-center text-sm text-slate-500">
                    No production entries found for this selection.
                  </td>
                </tr>
              )}
              {pageRows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-amber-50/50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(row.entry_date)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{DEPARTMENT_BY_CODE[row.department].shortName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.shift}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{row.operator_name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.machine_name}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-700" title={row.job_ref}>{row.job_ref}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatNumber(row.qty_kg, 2)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{formatNumber(row.qty_meters)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-red-700">{formatNumber(row.wastage_kg, 2)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.downtime_reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} />
      </section>
    </div>
  );
}

function BreakdownRow({ label, totals }: { label: string; totals: EntryTotals }) {
  return (
    <tr className="transition-colors hover:bg-slate-50">
      <td className="px-4 py-3 font-medium text-slate-900">{label}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{totals.count}</td>
      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">{formatNumber(totals.qtyKg, 2)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatNumber(totals.qtyMeters)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-red-700">{formatNumber(totals.wastageKg, 2)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{totals.wastagePct.toFixed(2)}%</td>
    </tr>
  );
}
