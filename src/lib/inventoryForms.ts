import { todayISO } from '@/lib/dates';
import {
  type InventoryCategory,
  type InventoryDepartment,
  type InventoryUnit,
  type NewInventoryItem,
  type NewStockTransaction,
  type RawMaterialType,
  type StockSummary,
} from '@/lib/inventory';

export interface ItemFormValues {
  item_name: string;
  category: InventoryCategory | '';
  material_type: RawMaterialType | '';
  supplier: string;
  unit: InventoryUnit | '';
  opening_stock: string;
  opening_rate: string;
  minimum_stock: string;
  reorder_level: string;
}

export interface PurchaseFormValues {
  txn_date: string;
  item_id: string;
  supplier_name: string;
  grn_no: string;
  supplier_invoice_no: string;
  quantity: string;
  rate: string;
}

export interface IssueFormValues {
  txn_date: string;
  item_id: string;
  department: InventoryDepartment | '';
  job_card_no: string;
  quantity: string;
}

export interface AdjustmentFormValues {
  txn_date: string;
  item_id: string;
  direction: 'increase' | 'decrease';
  quantity: string;
  reason: string;
}

export function itemFormEmpty(): ItemFormValues {
  return {
    item_name: '',
    category: '',
    material_type: '',
    supplier: '',
    unit: '',
    opening_stock: '0',
    opening_rate: '0',
    minimum_stock: '0',
    reorder_level: '0',
  };
}

export function itemFormFromSummary(item: StockSummary): ItemFormValues {
  return {
    item_name: item.item_name,
    category: item.category,
    material_type: item.material_type ?? '',
    supplier: item.supplier,
    unit: item.unit,
    opening_stock: String(item.opening_stock),
    opening_rate: '0',
    minimum_stock: String(item.minimum_stock),
    reorder_level: String(item.reorder_level),
  };
}

export function purchaseFormEmpty(): PurchaseFormValues {
  return {
    txn_date: todayISO(),
    item_id: '',
    supplier_name: '',
    grn_no: '',
    supplier_invoice_no: '',
    quantity: '',
    rate: '',
  };
}

export function issueFormEmpty(): IssueFormValues {
  return { txn_date: todayISO(), item_id: '', department: '', job_card_no: '', quantity: '' };
}

export function adjustmentFormEmpty(): AdjustmentFormValues {
  return { txn_date: todayISO(), item_id: '', direction: 'increase', quantity: '', reason: '' };
}

function isNonNegativeNumber(raw: string): boolean {
  const parsed = Number(raw);
  return raw.trim() !== '' && Number.isFinite(parsed) && parsed >= 0;
}

function isPositiveNumber(raw: string): boolean {
  return isNonNegativeNumber(raw) && Number(raw) > 0;
}

export function validateItemForm(values: ItemFormValues, editing: boolean): string | null {
  if (!values.item_name.trim()) return 'Item name is required.';
  if (!editing) {
    if (!values.category) return 'Choose a category.';
    if (values.category === 'Raw Material' && !values.material_type) return 'Choose a raw material type.';
    if (!values.unit) return 'Choose a unit.';
    if (!isNonNegativeNumber(values.opening_stock)) return 'Opening stock must be a number, zero or more.';
    if (!isNonNegativeNumber(values.opening_rate)) return 'Opening rate must be a number, zero or more.';
  }
  if (!isNonNegativeNumber(values.minimum_stock)) return 'Minimum stock must be a number, zero or more.';
  if (!isNonNegativeNumber(values.reorder_level)) return 'Reorder level must be a number, zero or more.';
  return null;
}

export function buildNewItemPayload(values: ItemFormValues): NewInventoryItem {
  const isRaw = values.category === 'Raw Material';
  return {
    item_name: values.item_name.trim(),
    category: values.category as InventoryCategory,
    material_type: isRaw && values.material_type ? values.material_type : null,
    supplier: values.supplier.trim(),
    unit: values.unit as InventoryUnit,
    opening_stock: Number(values.opening_stock),
    opening_rate: Number(values.opening_rate),
    minimum_stock: Number(values.minimum_stock),
    reorder_level: Number(values.reorder_level),
  };
}

export function validatePurchaseForm(values: PurchaseFormValues): string | null {
  if (!values.txn_date) return 'Date is required.';
  if (!values.item_id) return 'Choose an item.';
  if (!values.grn_no.trim()) return 'GRN number is required.';
  if (!isPositiveNumber(values.quantity)) return 'Quantity must be greater than zero.';
  if (!isNonNegativeNumber(values.rate)) return 'Rate must be a number, zero or more.';
  return null;
}

export function buildPurchasePayload(values: PurchaseFormValues): NewStockTransaction {
  return {
    item_id: values.item_id,
    txn_type: 'purchase',
    txn_date: values.txn_date,
    quantity: Number(values.quantity),
    rate: Number(values.rate),
    supplier_name: values.supplier_name.trim(),
    grn_no: values.grn_no.trim(),
    supplier_invoice_no: values.supplier_invoice_no.trim(),
    department: null,
    job_card_no: '',
    reason: '',
  };
}

export function validateIssueForm(values: IssueFormValues): string | null {
  if (!values.txn_date) return 'Date is required.';
  if (!values.item_id) return 'Choose an item.';
  if (!values.department) return 'Choose the department the stock is issued to.';
  if (!values.job_card_no.trim()) return 'Job card number is required.';
  if (!isPositiveNumber(values.quantity)) return 'Quantity must be greater than zero.';
  return null;
}

export function buildIssuePayload(values: IssueFormValues): NewStockTransaction {
  return {
    item_id: values.item_id,
    txn_type: 'issue',
    txn_date: values.txn_date,
    quantity: Number(values.quantity),
    rate: 0,
    supplier_name: '',
    grn_no: '',
    supplier_invoice_no: '',
    department: values.department || null,
    job_card_no: values.job_card_no.trim(),
    reason: '',
  };
}

export function validateAdjustmentForm(values: AdjustmentFormValues): string | null {
  if (!values.txn_date) return 'Date is required.';
  if (!values.item_id) return 'Choose an item.';
  if (!isPositiveNumber(values.quantity)) return 'Quantity must be greater than zero.';
  if (!values.reason.trim()) return 'Give a reason for the adjustment, for example a physical count difference.';
  return null;
}

export function buildAdjustmentPayload(values: AdjustmentFormValues): NewStockTransaction {
  return {
    item_id: values.item_id,
    txn_type: values.direction === 'increase' ? 'adjustment_in' : 'adjustment_out',
    txn_date: values.txn_date,
    quantity: Number(values.quantity),
    rate: 0,
    supplier_name: '',
    grn_no: '',
    supplier_invoice_no: '',
    department: null,
    job_card_no: '',
    reason: values.reason.trim(),
  };
}
