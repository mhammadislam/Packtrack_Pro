import { useEffect, useMemo, useState } from 'react';
import { Banknote, CircleDollarSign, Plus, Receipt, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { StatCard } from '@/components/ui/StatCard';
import { TextInput } from '@/components/ui/Field';
import { DispatchFormModal } from '@/components/dispatch/DispatchFormModal';
import { DispatchDetailModal } from '@/components/dispatch/DispatchDetailModal';
import { fetchDispatches, formatMoney, type DispatchRecord } from '@/lib/dispatch';
import { fetchStockSummary, type StockSummary } from '@/lib/inventory';
import { formatDate } from '@/lib/dates';

type DispatchModal = { kind: 'create' } | { kind: 'detail'; id: string } | null;

function matchesSearch(dispatch: DispatchRecord, term: string): boolean {
  if (!term) return true;
  return [dispatch.dispatch_no, dispatch.customer_name, dispatch.po_number, dispatch.vehicle_no, dispatch.lr_no]
    .some((value) => value.toLowerCase().includes(term));
}

export function DispatchPage() {
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [products, setProducts] = useState<StockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState(0);
  const [modal, setModal] = useState<DispatchModal>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([fetchDispatches(), fetchStockSummary()])
      .then(([rows, stock]) => {
        if (!active) return;
        setDispatches(rows);
        setProducts(stock.filter((item) => item.category === 'Finished Goods'));
      })
      .catch((caught) => {
        if (active) setLoadError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version]);

  const term = query.trim().toLowerCase();
  const visible = useMemo(() => dispatches.filter((dispatch) => matchesSearch(dispatch, term)), [dispatches, term]);
  const unpaid = dispatches.filter((dispatch) => dispatch.payment_status === 'Unpaid');
  const totalBilled = dispatches.reduce((sum, dispatch) => sum + dispatch.grand_total, 0);
  const unpaidTotal = unpaid.reduce((sum, dispatch) => sum + dispatch.grand_total, 0);

  const selected = modal?.kind === 'detail' ? dispatches.find((dispatch) => dispatch.id === modal.id) ?? null : null;

  const handleSaved = () => {
    setModal(null);
    setNotice('Dispatch saved and finished goods stock updated.');
    setVersion((value) => value + 1);
  };

  const handlePaymentChanged = (message: string) => {
    setNotice(message);
    setVersion((value) => value + 1);
  };

  return (
    <div className="flex flex-col gap-6">
      {notice && <Alert tone="success">{notice}</Alert>}
      {loadError && <Alert tone="error">{loadError}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Dispatches" value={String(dispatches.length)} icon={Receipt} footnote="All dispatch notes" />
        <StatCard label="Total billed" value={formatMoney(totalBilled)} icon={Banknote} tone="emerald" footnote="Including GST" />
        <StatCard label="Unpaid" value={formatMoney(unpaidTotal)} icon={CircleDollarSign} tone="red" footnote={`${unpaid.length} dispatch${unpaid.length === 1 ? '' : 'es'} awaiting payment`} />
      </div>

      <div className="glass-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <TextInput
            aria-label="Search dispatches"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search DN no, customer, PO, vehicle, LR"
            className="pl-9"
          />
        </div>
        <Button onClick={() => setModal({ kind: 'create' })} icon={<Plus className="h-4 w-4" />}>
          New dispatch
        </Button>
      </div>

      <div className="glass-panel overflow-hidden">
        {loading && dispatches.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">Loading dispatches...</p>
        ) : dispatches.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="rounded-full bg-slate-100 p-3 text-slate-700">
              <Receipt className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-slate-900">No dispatches yet</p>
            <p className="max-w-sm text-sm text-slate-500">Create your first dispatch note to bill a customer and deduct the products from finished goods stock.</p>
            <Button onClick={() => setModal({ kind: 'create' })} icon={<Plus className="h-4 w-4" />}>
              New dispatch
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">No dispatches match your search.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">DN No</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Vehicle</th>
                  <th className="px-4 py-3 text-right font-semibold">Items</th>
                  <th className="px-4 py-3 text-right font-semibold">Grand total</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visible.map((dispatch) => (
                  <tr
                    key={dispatch.id}
                    onClick={() => setModal({ kind: 'detail', id: dispatch.id })}
                    className="cursor-pointer text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">{dispatch.dispatch_no}</td>
                    <td className="px-4 py-3">{formatDate(dispatch.dispatch_date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{dispatch.customer_name}</td>
                    <td className="px-4 py-3">{dispatch.vehicle_no || '-'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{dispatch.lines.length}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatMoney(dispatch.grand_total)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          dispatch.payment_status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-amber-50 text-amber-700 ring-amber-200'
                        }`}
                      >
                        {dispatch.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.kind === 'create' && (
        <DispatchFormModal items={products} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {selected && (
        <DispatchDetailModal dispatch={selected} onClose={() => setModal(null)} onPaymentChanged={handlePaymentChanged} />
      )}
    </div>
  );
}
