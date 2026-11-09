import { RotateCcw, Search } from 'lucide-react';
import { SelectInput, TextInput } from '@/components/ui/Field';
import type { QcFilter } from '@/lib/qc';

interface QcFiltersProps {
  filters: QcFilter;
  customers: string[];
  onChange: (next: QcFilter) => void;
  onReset: () => void;
}

export function QcFilters({ filters, customers, onChange, onReset }: QcFiltersProps) {
  return (
    <div className="glass-panel grid grid-cols-1 gap-4 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1.2fr_auto] xl:items-end">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Search</span>
        <span className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <TextInput
            className="pl-9"
            placeholder="Report no, job card, customer..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
        </span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">From</span>
        <TextInput type="date" value={filters.from} onChange={(e) => onChange({ ...filters, from: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">To</span>
        <TextInput type="date" value={filters.to} onChange={(e) => onChange({ ...filters, to: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Customer</span>
        <SelectInput value={filters.customer} onChange={(e) => onChange({ ...filters, customer: e.target.value })}>
          <option value="">All customers</option>
          {customers.map((customer) => (
            <option key={customer} value={customer}>
              {customer}
            </option>
          ))}
        </SelectInput>
      </label>
      <button
        type="button"
        onClick={onReset}
        className="glass-button px-4 py-2 text-sm font-semibold"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Reset
      </button>
    </div>
  );
}
