import { supabase } from '@/lib/supabase';
import { COMPANY } from '@/lib/company';
import { formatDate, formatNumber } from '@/lib/dates';
import { toNumber, toText, type InventoryUnit } from '@/lib/inventory';

export const DISPATCH_GST_RATE = 18;
export const PAYMENT_STATUSES = ['Paid', 'Unpaid'] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface DispatchLine {
  id: string;
  line_no: number;
  item_id: string;
  item_code: string;
  item_name: string;
  unit: InventoryUnit;
  size: string;
  qty_kg: number;
  qty_pcs: number;
  rate: number;
  amount: number;
}

export interface DispatchRecord {
  id: string;
  dispatch_no: string;
  dispatch_date: string;
  customer_name: string;
  po_number: string;
  vehicle_no: string;
  lr_no: string;
  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  grand_total: number;
  payment_status: PaymentStatus;
  created_at: string;
  lines: DispatchLine[];
}

export interface DispatchLineInput {
  item_id: string;
  size: string;
  qty_kg: number;
  qty_pcs: number;
  rate: number;
}

export interface DispatchInput {
  dispatch_date: string;
  customer_name: string;
  po_number: string;
  vehicle_no: string;
  lr_no: string;
  payment_status: PaymentStatus;
  lines: DispatchLineInput[];
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function billedQuantity(unit: InventoryUnit, qtyKg: number, qtyPcs: number): number {
  if (unit === 'Kg') return qtyKg;
  if (unit === 'Pcs') return qtyPcs;
  return 0;
}

export function calculateTotals(amounts: number[]): { subtotal: number; gst: number; total: number } {
  const subtotal = roundMoney(amounts.reduce((sum, amount) => sum + amount, 0));
  const gst = roundMoney((subtotal * DISPATCH_GST_RATE) / 100);
  return { subtotal, gst, total: roundMoney(subtotal + gst) };
}

export function formatMoney(value: number): string {
  return `PKR ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatQuantity(value: number, unit: InventoryUnit): string {
  return `${formatNumber(value, 3)} ${unit}`;
}

function normalizeLine(row: Record<string, unknown>): DispatchLine {
  const item = (row.inventory_items ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    line_no: toNumber(row.line_no),
    item_id: String(row.item_id),
    item_code: toText(item.item_code),
    item_name: toText(item.item_name),
    unit: item.unit as InventoryUnit,
    size: toText(row.size),
    qty_kg: toNumber(row.qty_kg),
    qty_pcs: toNumber(row.qty_pcs),
    rate: toNumber(row.rate),
    amount: toNumber(row.amount),
  };
}

function normalizeDispatch(row: Record<string, unknown>): DispatchRecord {
  const lines = Array.isArray(row.dispatch_items)
    ? (row.dispatch_items as Record<string, unknown>[]).map(normalizeLine).sort((a, b) => a.line_no - b.line_no)
    : [];
  return {
    id: String(row.id),
    dispatch_no: toText(row.dispatch_no),
    dispatch_date: toText(row.dispatch_date),
    customer_name: toText(row.customer_name),
    po_number: toText(row.po_number),
    vehicle_no: toText(row.vehicle_no),
    lr_no: toText(row.lr_no),
    subtotal: toNumber(row.subtotal),
    gst_rate: toNumber(row.gst_rate),
    gst_amount: toNumber(row.gst_amount),
    grand_total: toNumber(row.grand_total),
    payment_status: row.payment_status === 'Paid' ? 'Paid' : 'Unpaid',
    created_at: toText(row.created_at),
    lines,
  };
}

export async function fetchDispatches(): Promise<DispatchRecord[]> {
  const { data, error } = await supabase
    .from('dispatch_master')
    .select('*, dispatch_items(id, line_no, item_id, size, qty_kg, qty_pcs, rate, amount, inventory_items(item_code, item_name, unit))')
    .order('dispatch_no', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((row) => normalizeDispatch(row));
}

export async function createDispatch(input: DispatchInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_dispatch', {
    p_dispatch_date: input.dispatch_date,
    p_customer_name: input.customer_name,
    p_po_number: input.po_number,
    p_vehicle_no: input.vehicle_no,
    p_lr_no: input.lr_no,
    p_payment_status: input.payment_status,
    p_items: input.lines,
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('The dispatch could not be saved. Please try again.');
  return data;
}

export async function updatePaymentStatus(id: string, status: PaymentStatus): Promise<void> {
  const { data, error } = await supabase
    .from('dispatch_master')
    .update({ payment_status: status })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('This dispatch could not be updated. You may not have permission.');
}

export function whatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function dispatchShareMessage(dispatch: DispatchRecord): string {
  const itemLines = dispatch.lines.map((line) => {
    const billed = billedQuantity(line.unit, line.qty_kg, line.qty_pcs);
    const size = line.size ? ` (${line.size})` : '';
    return `- ${line.item_name}${size}: ${formatQuantity(billed, line.unit)}`;
  });
  return [
    `Dispatch ${dispatch.dispatch_no} - ${COMPANY.name}`,
    `Date: ${formatDate(dispatch.dispatch_date)}`,
    `Customer: ${dispatch.customer_name}`,
    dispatch.po_number ? `PO: ${dispatch.po_number}` : '',
    dispatch.vehicle_no ? `Vehicle: ${dispatch.vehicle_no}` : '',
    dispatch.lr_no ? `LR/Bilty: ${dispatch.lr_no}` : '',
    'Items:',
    ...itemLines,
    `Subtotal: ${formatMoney(dispatch.subtotal)}`,
    `GST (${dispatch.gst_rate}%): ${formatMoney(dispatch.gst_amount)}`,
    `Grand total: ${formatMoney(dispatch.grand_total)}`,
    `Payment status: ${dispatch.payment_status}`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}
