import { useMemo, useState } from 'react';
import { Barcode, Pencil, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import { StockStatusBadge } from '@/components/inventory/StockStatusBadge';
import { formatNumber } from '@/lib/dates';
import { INVENTORY_CATEGORIES, itemMatchesSearch, stockStatus, type InventoryCategory, type StockSummary } from '@/lib/inventory';

interface StockItemsViewProps {
  items: StockSummary[];
  onEdit: (item: StockSummary) => void;
  onBarcode: (item: StockSummary) => void;
  onDelete?: (item: StockSummary) => void;
}

const HEADERS = ['Code', 'Item', 'Category', 'Supplier', 'Unit', 'Opening', 'Purchase In', 'Issue Out', 'Adjust (net)', 'Current', 'Minimum', 'Avg Rate', 'Stock Value', 'Status', ''];

export function StockItemsView({ items, onEdit, onBarcode, onDelete }: StockItemsViewProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<InventoryCategory | ''>('');

  const visible = useMemo(
    () => items.filter((item) => (!category || item.category === category) && itemMatchesSearch(item, search)),
    [items, category, search],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-panel grid gap-4 p-4 sm:grid-cols-[1fr_220px]">
        <Field label="Search" htmlFor="stock-search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <TextInput id="stock-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Code, item name or supplier" className="pl-9" />
          </div>
        </Field>
        <Field label="Category" htmlFor="stock-category">
          <SelectInput id="stock-category" value={category} onChange={(event) => setCategory(event.target.value as InventoryCategory | '')}>
            <option value="">All categories</option>
            {INVENTORY_CATEGORIES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <section className="glass-panel overflow-hidden">
        {visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">No items match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  {HEADERS.map((header, index) => (
                    <th key={`${header}-${index}`} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const status = stockStatus(item);
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-slate-100 text-slate-700 transition-colors hover:bg-slate-50 ${status === 'low' ? 'bg-red-50/50' : ''}`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-900">{item.item_code}</td>
                      <td className="max-w-[220px] px-4 py-3">
                        <p className="truncate font-medium text-slate-900">{item.item_name}</p>
                        {item.material_type && <p className="text-xs text-slate-500">{item.material_type}</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{item.category}</td>
                      <td className="max-w-[160px] truncate px-4 py-3">{item.supplier || '-'}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.unit}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatNumber(item.opening_stock, 3)}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatNumber(item.purchase_in, 3)}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatNumber(item.issue_out, 3)}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatNumber(item.adjust_in - item.adjust_out, 3)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums text-slate-900">{formatNumber(item.current_stock, 3)}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatNumber(item.minimum_stock, 3)}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatNumber(item.avg_rate)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-slate-900">{formatNumber(item.stock_value)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StockStatusBadge status={status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button variant="ghost" className="!px-2 !py-1.5" onClick={() => onEdit(item)} aria-label={`Edit ${item.item_code}`} icon={<Pencil className="h-3.5 w-3.5" />}>
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button variant="ghost" className="!px-2 !py-1.5" onClick={() => onBarcode(item)} aria-label={`Barcode for ${item.item_code}`} icon={<Barcode className="h-3.5 w-3.5" />}>
                            <span className="sr-only">Barcode</span>
                          </Button>
                          {onDelete && (
                            <Button variant="ghost" className="!px-2 !py-1.5 text-red-600" onClick={() => onDelete(item)} aria-label={`Move ${item.item_code} to Trash`} icon={<Trash2 className="h-3.5 w-3.5" />}>
                              <span className="sr-only">Move to Trash</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
