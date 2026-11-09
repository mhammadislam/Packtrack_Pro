import { INVENTORY_DEPARTMENTS, type InventoryDepartment, type LedgerRow } from '@/lib/inventory';

export interface ConsumptionRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  byDepartment: Record<InventoryDepartment, number>;
  total: number;
}

export interface SupplierPurchaseRow {
  supplier: string;
  grnCount: number;
  quantity: number;
  amount: number;
}

export function consumptionByItem(rows: LedgerRow[]): ConsumptionRow[] {
  const map = new Map<string, ConsumptionRow>();

  for (const row of rows) {
    if (row.txn_type !== 'issue') continue;
    let entry = map.get(row.item_id);
    if (!entry) {
      entry = {
        itemId: row.item_id,
        itemCode: row.item_code,
        itemName: row.item_name,
        unit: row.unit,
        byDepartment: Object.fromEntries(INVENTORY_DEPARTMENTS.map((department) => [department, 0])) as Record<InventoryDepartment, number>,
        total: 0,
      };
      map.set(row.item_id, entry);
    }
    if (row.department) entry.byDepartment[row.department] += row.qty_out;
    entry.total += row.qty_out;
  }

  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function purchasesBySupplier(rows: LedgerRow[]): SupplierPurchaseRow[] {
  const map = new Map<string, { grns: Set<string>; quantity: number; amount: number }>();

  for (const row of rows) {
    if (row.txn_type !== 'purchase') continue;
    const supplier = row.supplier_name.trim() || 'Unassigned';
    const entry = map.get(supplier) ?? { grns: new Set<string>(), quantity: 0, amount: 0 };
    if (row.grn_no) entry.grns.add(row.grn_no);
    entry.quantity += row.qty_in;
    entry.amount += row.amount;
    map.set(supplier, entry);
  }

  return [...map.entries()]
    .map(([supplier, entry]) => ({
      supplier,
      grnCount: entry.grns.size,
      quantity: entry.quantity,
      amount: entry.amount,
    }))
    .sort((a, b) => b.amount - a.amount);
}
