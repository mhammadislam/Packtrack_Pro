import { supabase } from '@/lib/supabase';
import { DEPARTMENTS } from '@/lib/constants';
import { formatDate, formatNumber } from '@/lib/dates';

export type TrashKind = 'entry' | 'qc' | 'stock' | 'operator' | 'machine';

export const TRASH_KIND_LABEL: Record<TrashKind, string> = {
  entry: 'Production entry',
  qc: 'QC report',
  stock: 'Stock item',
  operator: 'Operator',
  machine: 'Machine',
};

export interface TrashItem {
  key: string;
  kind: TrashKind;
  id: string;
  name: string;
  department: string;
  details: string;
  deletedAt: string;
  deletedBy: string | null;
}

const TRASH_QUERY_LIMIT = 500;

const RESTORE_RPC: Record<TrashKind, string> = {
  entry: 'restore_production_entry',
  qc: 'restore_qc_report',
  stock: 'restore_inventory_item',
  operator: 'restore_operator',
  machine: 'restore_machine',
};

const PURGE_RPC: Record<TrashKind, string> = {
  entry: 'purge_production_entry',
  qc: 'purge_qc_report',
  stock: 'purge_inventory_item',
  operator: 'purge_operator',
  machine: 'purge_machine',
};

interface DeletedMarker {
  deleted_at: string;
  deleted_by: string | null;
}

interface DeletedEntryRow extends DeletedMarker {
  id: string;
  department: string;
  entry_date: string;
  operator_name: string | null;
  machine_name: string | null;
  job_ref: string | null;
  lot_number: string | null;
  qty_kg: number | string | null;
}

interface DeletedQcRow extends DeletedMarker {
  id: string;
  report_no: string;
  report_date: string;
  customer_name: string | null;
  machine_no: string | null;
}

interface DeletedStockRow extends DeletedMarker {
  id: string;
  item_code: string;
  item_name: string;
  category: string;
}

interface DeletedOperatorRow extends DeletedMarker {
  id: string;
  name: string;
}

interface DeletedMachineRow extends DeletedMarker {
  id: string;
  department: string;
  name: string;
}

function departmentLabel(code: string): string {
  return DEPARTMENTS.find((department) => department.code === code)?.shortName ?? code;
}

function toTrashItem(kind: TrashKind, row: DeletedMarker & { id: string }, fields: Pick<TrashItem, 'name' | 'department' | 'details'>): TrashItem {
  return {
    key: `${kind}:${row.id}`,
    kind,
    id: row.id,
    deletedAt: String(row.deleted_at),
    deletedBy: row.deleted_by ? String(row.deleted_by) : null,
    ...fields,
  };
}

export async function fetchTrashItems(): Promise<TrashItem[]> {
  const [entries, qcReports, stockItems, operators, machines] = await Promise.all([
    supabase
      .from('production_entries')
      .select('id, department, entry_date, operator_name, machine_name, job_ref, lot_number, qty_kg, deleted_at, deleted_by')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(TRASH_QUERY_LIMIT),
    supabase
      .from('qc_reports')
      .select('id, report_no, report_date, customer_name, machine_no, deleted_at, deleted_by')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(TRASH_QUERY_LIMIT),
    supabase
      .from('inventory_items')
      .select('id, item_code, item_name, category, deleted_at, deleted_by')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(TRASH_QUERY_LIMIT),
    supabase
      .from('operators')
      .select('id, name, deleted_at, deleted_by')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(TRASH_QUERY_LIMIT),
    supabase
      .from('machines')
      .select('id, department, name, deleted_at, deleted_by')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(TRASH_QUERY_LIMIT),
  ]);

  for (const result of [entries, qcReports, stockItems, operators, machines]) {
    if (result.error) throw result.error;
  }

  const items: TrashItem[] = [
    ...((entries.data ?? []) as DeletedEntryRow[]).map((row) =>
      toTrashItem('entry', row, {
        name: row.job_ref || row.lot_number || row.operator_name || 'Production entry',
        department: departmentLabel(row.department),
        details: [formatDate(row.entry_date), row.machine_name, row.qty_kg != null ? `${formatNumber(Number(row.qty_kg), 2)} kg` : null]
          .filter(Boolean)
          .join(' · '),
      }),
    ),
    ...((qcReports.data ?? []) as DeletedQcRow[]).map((row) =>
      toTrashItem('qc', row, {
        name: row.report_no,
        department: 'Quality Control',
        details: [row.customer_name, formatDate(row.report_date), row.machine_no].filter(Boolean).join(' · '),
      }),
    ),
    ...((stockItems.data ?? []) as DeletedStockRow[]).map((row) =>
      toTrashItem('stock', row, {
        name: row.item_name,
        department: 'Stores',
        details: `${row.item_code} · ${row.category}`,
      }),
    ),
    ...((operators.data ?? []) as DeletedOperatorRow[]).map((row) =>
      toTrashItem('operator', row, {
        name: row.name,
        department: 'Operators list',
        details: '',
      }),
    ),
    ...((machines.data ?? []) as DeletedMachineRow[]).map((row) =>
      toTrashItem('machine', row, {
        name: row.name,
        department: departmentLabel(row.department),
        details: 'Machine',
      }),
    ),
  ];

  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export async function restoreTrashItem(item: TrashItem) {
  const { error } = await supabase.rpc(RESTORE_RPC[item.kind], { p_id: item.id });
  if (error) throw error;
}

export async function purgeTrashItem(item: TrashItem) {
  const { error } = await supabase.rpc(PURGE_RPC[item.kind], { p_id: item.id });
  if (error) throw error;
}
