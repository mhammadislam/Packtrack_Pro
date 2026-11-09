import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Field, TextInput } from '@/components/ui/Field';
import { currentYearMonth, formatNumber, monthRange } from '@/lib/dates';
import { INVENTORY_DEPARTMENTS, fetchLedger, type LedgerRow } from '@/lib/inventory';
import { consumptionByItem, purchasesBySupplier } from '@/lib/inventoryReports';

const EMPTY_STATE = 'No records for this month.';

function SectionShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="glass-panel overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ConsumptionTable({ rows }: { rows: LedgerRow[] }) {
  const data = useMemo(() => consumptionByItem(rows), [rows]);
  if (data.length === 0) return <p className="py-12 text-center text-sm text-slate-500">{EMPTY_STATE}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.14em] text-slate-500">
            <th scope="col" className="px-4 py-3 font-semibold">Item</th>
            {INVENTORY_DEPARTMENTS.map((department) => (
              <th key={department} scope="col" className="whitespace-nowrap px-4 py-3 text-right font-semibold">{department}</th>
            ))}
            <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.itemId} className="border-b border-slate-100 text-slate-700">
              <td className="max-w-[260px] px-4 py-3">
                <p className="font-mono text-xs text-slate-500">{row.itemCode}</p>
                <p className="truncate font-medium text-slate-900">{row.itemName}</p>
              </td>
              {INVENTORY_DEPARTMENTS.map((department) => (
                <td key={department} className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {row.byDepartment[department] ? `${formatNumber(row.byDepartment[department], 3)} ${row.unit}` : '-'}
                </td>
              ))}
              <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                {formatNumber(row.total, 3)} {row.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SupplierTable({ rows }: { rows: LedgerRow[] }) {
  const data = useMemo(() => purchasesBySupplier(rows), [rows]);
  const totalAmount = data.reduce((sum, row) => sum + row.amount, 0);
  if (data.length === 0) return <p className="py-12 text-center text-sm text-slate-500">{EMPTY_STATE}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.14em] text-slate-500">
            {['Supplier', 'GRNs', 'Quantity', 'Amount', 'Share'].map((header) => (
              <th key={header} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.supplier} className="border-b border-slate-100 text-slate-700">
              <td className="px-4 py-3 font-medium text-slate-900">{row.supplier}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{row.grnCount}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatNumber(row.quantity, 3)}</td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-slate-900">{formatNumber(row.amount)}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-slate-900" style={{ width: `${totalAmount ? (row.amount / totalAmount) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs tabular-nums text-slate-500">{totalAmount ? ((row.amount / totalAmount) * 100).toFixed(1) : '0.0'}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InventoryReports({ version }: { version: number }) {
  const [month, setMonth] = useState(currentYearMonth);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const range = monthRange(month);
    if (!range) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetchLedger({ itemId: '', txnType: '', from: range.from, to: range.to })
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((caught) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month, version]);

  return (
    <div className="flex flex-col gap-6">
      <div className="glass-panel grid gap-4 p-4 sm:max-w-xs">
        <Field label="Month" htmlFor="report-month">
          <TextInput id="report-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </Field>
      </div>

      {error && <Alert tone="error">The report could not be loaded. {error}</Alert>}

      {loading ? (
        <div className="glass-panel h-48 animate-pulse bg-slate-50" aria-label="Loading" />
      ) : (
        <>
          <SectionShell title="Monthly consumption" subtitle="Quantity issued to each department this month">
            <ConsumptionTable rows={rows} />
          </SectionShell>
          <SectionShell title="Supplier-wise purchases" subtitle="Goods received from each supplier this month">
            <SupplierTable rows={rows} />
          </SectionShell>
        </>
      )}
    </div>
  );
}
