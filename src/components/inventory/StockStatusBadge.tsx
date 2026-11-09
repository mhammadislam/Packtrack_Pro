import { STOCK_STATUS_LABEL, type StockStatus } from '@/lib/inventory';

const STATUS_CLASS: Record<StockStatus, string> = {
  low: 'border-red-300 bg-red-100 text-red-700 stock-alert-blink',
  reorder: 'border-amber-200 bg-amber-50 text-amber-700',
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {STOCK_STATUS_LABEL[status]}
    </span>
  );
}
