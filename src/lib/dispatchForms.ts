import { formatNumber, todayISO } from '@/lib/dates';
import type { StockSummary } from '@/lib/inventory';
import {
  billedQuantity,
  roundMoney,
  type DispatchInput,
  type PaymentStatus,
} from '@/lib/dispatch';

export const DISPATCH_MAX_LINES = 15;

export interface DispatchLineForm {
  key: string;
  item_id: string;
  size: string;
  qty_kg: string;
  qty_pcs: string;
  rate: string;
}

export interface DispatchFormValues {
  dispatch_date: string;
  customer_name: string;
  po_number: string;
  vehicle_no: string;
  lr_no: string;
  payment_status: PaymentStatus;
  lines: DispatchLineForm[];
}

export function newDispatchLine(): DispatchLineForm {
  return { key: crypto.randomUUID(), item_id: '', size: '', qty_kg: '', qty_pcs: '', rate: '' };
}

export function dispatchFormEmpty(): DispatchFormValues {
  return {
    dispatch_date: todayISO(),
    customer_name: '',
    po_number: '',
    vehicle_no: '',
    lr_no: '',
    payment_status: 'Unpaid',
    lines: [newDispatchLine()],
  };
}

function parseNumber(text: string): number {
  return text.trim() === '' ? 0 : Number(text);
}

function isValidQuantity(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function lineItem(line: DispatchLineForm, items: StockSummary[]): StockSummary | undefined {
  return items.find((candidate) => candidate.id === line.item_id);
}

export function lineAmount(line: DispatchLineForm, items: StockSummary[]): number {
  const item = lineItem(line, items);
  if (!item) return 0;
  const billed = billedQuantity(item.unit, parseNumber(line.qty_kg), parseNumber(line.qty_pcs));
  return roundMoney(billed * parseNumber(line.rate));
}

export function validateDispatchForm(values: DispatchFormValues, items: StockSummary[]): string | null {
  if (!values.dispatch_date) return 'Choose the dispatch date.';
  if (!values.customer_name.trim()) return 'Enter the customer name.';
  if (values.lines.length > DISPATCH_MAX_LINES) return `A dispatch can have at most ${DISPATCH_MAX_LINES} product lines.`;

  const requestedByItem = new Map<string, number>();
  for (const [index, line] of values.lines.entries()) {
    const no = index + 1;
    const item = lineItem(line, items);
    if (!item) return `Line ${no}: choose a finished goods product.`;
    if (item.unit === 'Ltr') return `Line ${no}: ${item.item_name} is measured in litres and cannot be dispatched.`;

    const qtyKg = parseNumber(line.qty_kg);
    const qtyPcs = parseNumber(line.qty_pcs);
    if (!isValidQuantity(qtyKg) || !isValidQuantity(qtyPcs)) return `Line ${no}: quantities must be positive numbers.`;
    if (line.rate.trim() === '' || !isValidQuantity(parseNumber(line.rate))) return `Line ${no}: enter the rate.`;

    const billed = billedQuantity(item.unit, qtyKg, qtyPcs);
    if (billed <= 0) return `Line ${no}: enter a quantity in ${item.unit}.`;

    const total = (requestedByItem.get(item.id) ?? 0) + billed;
    requestedByItem.set(item.id, total);
    if (total > item.current_stock) {
      return `Line ${no}: only ${formatNumber(item.current_stock, 3)} ${item.unit} of ${item.item_name} is in stock.`;
    }
  }
  return null;
}

export function buildDispatchInput(values: DispatchFormValues): DispatchInput {
  return {
    dispatch_date: values.dispatch_date,
    customer_name: values.customer_name.trim(),
    po_number: values.po_number.trim(),
    vehicle_no: values.vehicle_no.trim(),
    lr_no: values.lr_no.trim(),
    payment_status: values.payment_status,
    lines: values.lines.map((line) => ({
      item_id: line.item_id,
      size: line.size.trim(),
      qty_kg: parseNumber(line.qty_kg),
      qty_pcs: parseNumber(line.qty_pcs),
      rate: parseNumber(line.rate),
    })),
  };
}
