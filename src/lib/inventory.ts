import { supabase } from '@/lib/supabase';

export const INVENTORY_CATEGORIES = ['Raw Material', 'WIP', 'Finished Goods'] as const;
export const RAW_MATERIAL_TYPES = ['BOPP', 'PET', 'CPP', 'Ink', 'Solvent', 'Adhesive', 'Zipper'] as const;
export const INVENTORY_UNITS = ['Kg', 'Ltr', 'Pcs'] as const;
export const INVENTORY_DEPARTMENTS = ['Printing', 'Lamination', 'Slitting', 'Bag Making'] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];
export type RawMaterialType = (typeof RAW_MATERIAL_TYPES)[number];
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];
export type InventoryDepartment = (typeof INVENTORY_DEPARTMENTS)[number];
export type StockTxnType = 'purchase' | 'issue' | 'adjustment_in' | 'adjustment_out';
export type StockStatus = 'low' | 'reorder' | 'ok';

export const TXN_LABELS: Record<StockTxnType, string> = {
  purchase: 'Purchase',
  issue: 'Issue',
  adjustment_in: 'Adjustment (+)',
  adjustment_out: 'Adjustment (-)',
};

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  low: 'Low stock',
  reorder: 'Reorder',
  ok: 'In stock',
};

export interface StockSummary {
  id: string;
  item_code: string;
  item_name: string;
  category: InventoryCategory;
  material_type: RawMaterialType | null;
  supplier: string;
  unit: InventoryUnit;
  opening_stock: number;
  minimum_stock: number;
  reorder_level: number;
  purchase_in: number;
  issue_out: number;
  adjust_in: number;
  adjust_out: number;
  current_stock: number;
  avg_rate: number;
  stock_value: number;
}

export interface LedgerRow {
  id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  txn_type: StockTxnType;
  txn_date: string;
  qty_in: number;
  qty_out: number;
  running_balance: number;
  rate: number;
  amount: number;
  supplier_name: string;
  grn_no: string;
  supplier_invoice_no: string;
  department: InventoryDepartment | null;
  job_card_no: string;
  reason: string;
  created_at: string;
}

export interface LedgerFilter {
  itemId: string;
  txnType: StockTxnType | '';
  from: string;
  to: string;
}

export interface NewInventoryItem {
  item_name: string;
  category: InventoryCategory;
  material_type: RawMaterialType | null;
  supplier: string;
  unit: InventoryUnit;
  opening_stock: number;
  opening_rate: number;
  minimum_stock: number;
  reorder_level: number;
}

export interface InventoryItemUpdate {
  item_name: string;
  supplier: string;
  minimum_stock: number;
  reorder_level: number;
}

export interface NewStockTransaction {
  item_id: string;
  txn_type: StockTxnType;
  txn_date: string;
  quantity: number;
  rate: number;
  supplier_name: string;
  grn_no: string;
  supplier_invoice_no: string;
  department: InventoryDepartment | null;
  job_card_no: string;
  reason: string;
}

export function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

export function normalizeStockSummary(row: Record<string, unknown>): StockSummary {
  return {
    id: String(row.id),
    item_code: toText(row.item_code),
    item_name: toText(row.item_name),
    category: row.category as InventoryCategory,
    material_type: (row.material_type as RawMaterialType | null) ?? null,
    supplier: toText(row.supplier),
    unit: row.unit as InventoryUnit,
    opening_stock: toNumber(row.opening_stock),
    minimum_stock: toNumber(row.minimum_stock),
    reorder_level: toNumber(row.reorder_level),
    purchase_in: toNumber(row.purchase_in),
    issue_out: toNumber(row.issue_out),
    adjust_in: toNumber(row.adjust_in),
    adjust_out: toNumber(row.adjust_out),
    current_stock: toNumber(row.current_stock),
    avg_rate: toNumber(row.avg_rate),
    stock_value: toNumber(row.stock_value),
  };
}

export function normalizeLedgerRow(row: Record<string, unknown>): LedgerRow {
  return {
    id: String(row.id),
    item_id: String(row.item_id),
    item_code: toText(row.item_code),
    item_name: toText(row.item_name),
    category: row.category as InventoryCategory,
    unit: row.unit as InventoryUnit,
    txn_type: row.txn_type as StockTxnType,
    txn_date: toText(row.txn_date),
    qty_in: toNumber(row.qty_in),
    qty_out: toNumber(row.qty_out),
    running_balance: toNumber(row.running_balance),
    rate: toNumber(row.rate),
    amount: toNumber(row.amount),
    supplier_name: toText(row.supplier_name),
    grn_no: toText(row.grn_no),
    supplier_invoice_no: toText(row.supplier_invoice_no),
    department: (row.department as InventoryDepartment | null) ?? null,
    job_card_no: toText(row.job_card_no),
    reason: toText(row.reason),
    created_at: toText(row.created_at),
  };
}

export function stockStatus(item: Pick<StockSummary, 'current_stock' | 'minimum_stock' | 'reorder_level'>): StockStatus {
  if (item.current_stock < item.minimum_stock) return 'low';
  if (item.reorder_level > 0 && item.current_stock <= item.reorder_level) return 'reorder';
  return 'ok';
}

export async function fetchStockSummary(): Promise<StockSummary[]> {
  const { data, error } = await supabase
    .from('inventory_stock_summary')
    .select('*')
    .order('item_code', { ascending: true })
    .limit(2000);
  if (error) throw error;
  return (data ?? []).map((row) => normalizeStockSummary(row));
}

export async function deleteInventoryItem(id: string) {
  const { error } = await supabase.rpc('soft_delete_inventory_item', { p_id: id });
  if (error) throw error;
}

export async function fetchLedger(filter: LedgerFilter): Promise<LedgerRow[]> {
  let query = supabase
    .from('inventory_ledger')
    .select('*')
    .gte('txn_date', filter.from)
    .lte('txn_date', filter.to);

  if (filter.itemId) query = query.eq('item_id', filter.itemId);
  if (filter.txnType) query = query.eq('txn_type', filter.txnType);

  const { data, error } = await query
    .order('txn_date', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(5000);
  if (error) throw error;
  return (data ?? []).map((row) => normalizeLedgerRow(row));
}

export function itemMatchesSearch(row: StockSummary, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return [row.item_code, row.item_name, row.supplier].some((value) => value.toLowerCase().includes(term));
}

export async function insertInventoryItem(payload: NewInventoryItem) {
  const { error } = await supabase.from('inventory_items').insert(payload);
  if (error) throw error;
}

export async function updateInventoryItem(id: string, payload: InventoryItemUpdate) {
  const { data, error } = await supabase.from('inventory_items').update(payload).eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('This item could not be updated. You may not have permission.');
}

export async function insertStockTransaction(payload: NewStockTransaction) {
  const { error } = await supabase.from('stock_transactions').insert(payload);
  if (error) throw error;
}
