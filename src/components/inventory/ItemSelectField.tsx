import type { StockSummary } from '@/lib/inventory';
import { Field, SelectInput } from '@/components/ui/Field';

interface ItemSelectFieldProps {
  items: StockSummary[];
  value: string;
  onChange: (itemId: string) => void;
  selected: StockSummary | null;
}

export function ItemSelectField({ items, value, onChange, selected }: ItemSelectFieldProps) {
  return (
    <Field
      label="Item"
      htmlFor="stock-item"
      required
      hint={selected ? `Current stock: ${selected.current_stock.toLocaleString('en-US', { maximumFractionDigits: 3 })} ${selected.unit}` : undefined}
    >
      <SelectInput id="stock-item" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select item</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.item_code} - {item.item_name}
          </option>
        ))}
      </SelectInput>
    </Field>
  );
}
