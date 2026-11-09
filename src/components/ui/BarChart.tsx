interface BarChartItem {
  label: string;
  value: number;
  display: string;
}

interface BarChartProps {
  items: BarChartItem[];
  barClassName?: string;
  emptyText?: string;
}

export function BarChart({ items, barClassName = 'bg-slate-900', emptyText = 'No data for this period.' }: BarChartProps) {
  const max = Math.max(0, ...items.map((item) => item.value));

  if (items.length === 0 || max === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const width = Math.max(2, (item.value / max) * 100);
        return (
          <div key={item.label} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_auto]">
            <span className="truncate font-medium text-slate-700" title={item.label}>{item.label}</span>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${barClassName}`}
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="whitespace-nowrap font-semibold tabular-nums text-slate-900">{item.display}</span>
          </div>
        );
      })}
    </div>
  );
}
