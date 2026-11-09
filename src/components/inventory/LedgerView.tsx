import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import { addDaysISO, formatDate, formatNumber, todayISO } from '@/lib/dates';
import { exportLedgerToExcel } from '@/lib/inventoryExports';
import { fetchLedger, TXN_LABELS, type LedgerFilter, type LedgerRow, type StockSummary, type StockTxnType } from '@/lib/inventory';

interface LedgerViewProps {
  items: StockSummary[];
  version: number;
}

const TXN_TYPES: StockTxnType[] = ['purchase', 'issue', 'adjustment_in', 'adjustment_out'];

function defaultLedgerFilter(): LedgerFilter {
  const today = todayISO();
  return { itemId: '', txnType: '', from: addDaysISO(today, -30), to: today };
}

function referenceText(row: LedgerRow): string {
  if (row.txn_type === 'purchase') {
    const invoice = row.supplier_invoice_no ? ` / Inv ${row.supplier_invoice_no}` : '';
    return `GRN ${row.grn_no}${invoice}${row.supplier_name ? ` - ${row.supplier_name}` : ''}`;
  }
  if (row.txn_type === 'issue') return `${row.department ?? '-'} - Job ${row.job_card_no || '-'}`;
  return row.reason || '-';
}

export function LedgerView({ items, version }: LedgerViewProps) {
  const [filter, setFilter] = useState<LedgerFilter>(defaultLedgerFilter);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchLedger(filter)
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
  }, [filter, version]);

  const setField = <K extends keyof LedgerFilter>(key: K, value: LedgerFilter[K]) =>
    setFilter((current) => ({ ...current, [key]: value }));

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-panel grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
        <Field label="Item" htmlFor="ledger-item">
          <SelectInput id="ledger-item" value={filter.itemId} onChange={(event) => setField('itemId', event.target.value)}>
            <option value="">All items</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.item_code} - {item.item_name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Movement" htmlFor="ledger-type">
          <SelectInput id="ledger-type" value={filter.txnType} onChange={(event) => setField('txnType', event.target.value as LedgerFilter['txnType'])}>
            <option value="">All movements</option>
            {TXN_TYPES.map((type) => (
              <option key={type} value={type}>{TXN_LABELS[type]}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="From" htmlFor="ledger-from">
          <TextInput id="ledger-from" type="date" value={filter.from} onChange={(event) => setField('from', event.target.value)} />
        </Field>
        <Field label="To" htmlFor="ledger-to">
          <TextInput id="ledger-to" type="date" value={filter.to} onChange={(event) => setField('to', event.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button variant="secondary" onClick={() => exportLedgerToExcel(rows)} disabled={rows.length === 0 || loading} icon={<Download className="h-4 w-4" />} className="w-full">
            Export Excel
          </Button>
        </div>
      </div>

      {error && <Alert tone="error">The ledger could not be loaded. {error}</Alert>}

      <section className="glass-panel overflow-hidden">
        {loading ? (
          <div className="flex flex-col gap-3 p-6" aria-label="Loading">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">No stock movements in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  {['Date', 'Item', 'Movement', 'In', 'Out', 'Balance', 'Reference', 'Rate', 'Amount'].map((header) => (
                    <th key={header} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 text-slate-700 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(row.txn_date)}</td>
                    <td className="max-w-[220px] px-4 py-3">
                      <p className="font-mono text-xs text-slate-500">{row.item_code}</p>
                      <p className="truncate font-medium text-slate-900">{row.item_name}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{TXN_LABELS[row.txn_type]}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-emerald-700">{row.qty_in ? formatNumber(row.qty_in, 3) : ''}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-red-700">{row.qty_out ? formatNumber(row.qty_out, 3) : ''}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums text-slate-900">{formatNumber(row.running_balance, 3)}</td>
                    <td className="max-w-[260px] truncate px-4 py-3">{referenceText(row)}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{row.txn_type === 'purchase' ? formatNumber(row.rate) : ''}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{row.txn_type === 'purchase' ? formatNumber(row.amount) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
