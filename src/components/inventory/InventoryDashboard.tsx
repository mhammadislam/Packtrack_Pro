import { AlertTriangle, Boxes, ShoppingCart, Wallet } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { StockStatusBadge } from '@/components/inventory/StockStatusBadge';
import { formatNumber } from '@/lib/dates';
import { INVENTORY_CATEGORIES, stockStatus, type StockSummary } from '@/lib/inventory';

interface InventoryDashboardProps {
  items: StockSummary[];
}

export function InventoryDashboard({ items }: InventoryDashboardProps) {
  const totalValue = items.reduce((sum, item) => sum + item.stock_value, 0);
  const alerts = items
    .map((item) => ({ item, status: stockStatus(item) }))
    .filter(({ status }) => status !== 'ok')
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'low' ? -1 : 1));
  const lowCount = alerts.filter(({ status }) => status === 'low').length;
  const reorderCount = alerts.length - lowCount;
  const categoryValues = INVENTORY_CATEGORIES.map((category) => {
    const rows = items.filter((item) => item.category === category);
    return {
      category,
      count: rows.length,
      value: rows.reduce((sum, item) => sum + item.stock_value, 0),
    };
  });
  const maxCategoryValue = Math.max(...categoryValues.map((entry) => entry.value), 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total stock value" value={formatNumber(totalValue)} unit="PKR" icon={Wallet} tone="emerald" footnote="Current stock x average rate" />
        <StatCard label="Items tracked" value={String(items.length)} icon={Boxes} tone="slate" footnote="Raw, WIP and finished goods" />
        <StatCard label="Low stock" value={String(lowCount)} icon={AlertTriangle} tone="red" footnote="Below minimum level" />
        <StatCard label="Reorder due" value={String(reorderCount)} icon={ShoppingCart} tone="amber" footnote="At or below reorder level" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="glass-panel p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Stock alerts</h3>
            <span className="text-xs text-slate-500">{alerts.length} item{alerts.length === 1 ? '' : 's'}</span>
          </div>
          {alerts.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Every item is above its minimum and reorder levels.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {alerts.map(({ item, status }) => (
                <li key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      <span className="font-mono text-xs text-slate-500">{item.item_code}</span> {item.item_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Current {formatNumber(item.current_stock, 3)} {item.unit} | Minimum {formatNumber(item.minimum_stock, 3)} | Reorder {formatNumber(item.reorder_level, 3)}
                    </p>
                  </div>
                  <StockStatusBadge status={status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass-panel p-5">
          <h3 className="text-base font-semibold text-slate-900">Stock value by category</h3>
          <div className="mt-4 flex flex-col gap-5">
            {categoryValues.map((entry) => (
              <div key={entry.category}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-700">{entry.category}</span>
                  <span className="font-semibold tabular-nums text-slate-900">{formatNumber(entry.value)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-900 transition-all duration-500"
                    style={{ width: `${(entry.value / maxCategoryValue) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">{entry.count} item{entry.count === 1 ? '' : 's'}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
