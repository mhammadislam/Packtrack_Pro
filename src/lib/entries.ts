import { supabase } from '@/lib/supabase';
import { INK_COLORS, type DepartmentCode, type DepartmentConfig } from '@/lib/constants';
import type { EntryFormValues, InkUsage, ProductionEntry } from '@/lib/types';

const PAGE_SIZE = 1000;
const INSERT_BATCH_SIZE = 500;

export interface EntryRangeFilter {
  from: string;
  to: string;
  department?: DepartmentCode;
  operatorName?: string;
  machineName?: string;
}

export interface EntryPageQuery {
  department: DepartmentCode;
  search: string;
  page: number;
  pageSize: number;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  return toNumber(value);
}

function clockText(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 5) : '';
}

function toNullableClock(value: string): string | null {
  return value.trim() === '' ? null : value.trim();
}

function normalizeInkUsage(raw: unknown): InkUsage {
  if (!raw || typeof raw !== 'object') return {};
  const stored = raw as Record<string, unknown>;
  const usage: InkUsage = {};
  for (const { key } of INK_COLORS) {
    const item = stored[key];
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    usage[key] = {
      series: String(record.series ?? ''),
      received_kg: toNumber(record.received_kg),
      returned_kg: toNumber(record.returned_kg),
    };
  }
  return usage;
}

export function normalizeEntry(row: Record<string, unknown>): ProductionEntry {
  return {
    id: String(row.id),
    department: row.department as ProductionEntry['department'],
    entry_date: String(row.entry_date),
    shift: row.shift as ProductionEntry['shift'],
    operator_name: String(row.operator_name ?? ''),
    machine_name: String(row.machine_name ?? ''),
    job_ref: String(row.job_ref ?? ''),
    material: String(row.material ?? ''),
    size_spec: String(row.size_spec ?? ''),
    qty_kg: toNumber(row.qty_kg),
    qty_meters: toNumber(row.qty_meters),
    wastage_kg: toNumber(row.wastage_kg),
    downtime_reason: row.downtime_reason as ProductionEntry['downtime_reason'],
    remarks: String(row.remarks ?? ''),
    bag_length: toNullableNumber(row.bag_length),
    bag_width: toNullableNumber(row.bag_width),
    bag_type: (row.bag_type as ProductionEntry['bag_type']) ?? null,
    total_pcs: toNullableNumber(row.total_pcs),
    punch_zipper: (row.punch_zipper as ProductionEntry['punch_zipper']) ?? null,
    micron: toNullableNumber(row.micron),
    ink_usage: normalizeInkUsage(row.ink_usage),
    solvent_kg: toNullableNumber(row.solvent_kg),
    ethyl_kg: toNullableNumber(row.ethyl_kg),
    start_time: clockText(row.start_time),
    job_approval_time: clockText(row.job_approval_time),
    run_minutes: toNullableNumber(row.run_minutes),
    machine_speed: toNullableNumber(row.machine_speed),
    lot_number: String(row.lot_number ?? ''),
    order_qty: toNullableNumber(row.order_qty),
    weight_kg: toNullableNumber(row.weight_kg),
    trim_kg: toNullableNumber(row.trim_kg),
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at),
  };
}

export function sanitizeSearch(term: string): string {
  return term.replace(/[%_,()*"\\]/g, ' ').trim();
}

function inkUsagePayload(values: EntryFormValues): InkUsage {
  const usage: InkUsage = {};
  for (const { key } of INK_COLORS) {
    const series = values[`ink_${key}_series` as const].trim();
    const received = values[`ink_${key}_received` as const].trim();
    const returned = values[`ink_${key}_returned` as const].trim();
    if (series === '' && received === '' && returned === '') continue;
    usage[key] = { series, received_kg: toNumber(received), returned_kg: toNumber(returned) };
  }
  return usage;
}

export function buildEntryPayload(values: EntryFormValues, department: DepartmentConfig) {
  const bag = department.hasBagFields
    ? {
        bag_length: toNullableNumber(values.bag_length),
        bag_width: toNullableNumber(values.bag_width),
        bag_type: values.bag_type || null,
        total_pcs: toNullableNumber(values.total_pcs),
        punch_zipper: values.punch_zipper,
      }
    : {
        bag_length: null,
        bag_width: null,
        bag_type: null,
        total_pcs: null,
        punch_zipper: null,
      };

  const printing = department.hasPrintingFields
    ? {
        ink_usage: inkUsagePayload(values),
        solvent_kg: toNullableNumber(values.solvent_kg),
        ethyl_kg: toNullableNumber(values.ethyl_kg),
        start_time: toNullableClock(values.start_time),
        job_approval_time: toNullableClock(values.job_approval_time),
        run_minutes: toNullableNumber(values.run_minutes),
        machine_speed: toNullableNumber(values.machine_speed),
      }
    : {
        ink_usage: {},
        solvent_kg: null,
        ethyl_kg: null,
        start_time: null,
        job_approval_time: null,
        run_minutes: null,
        machine_speed: null,
      };

  const extrusion = department.hasExtrusionFields
    ? {
        lot_number: values.lot_number.trim(),
        order_qty: toNullableNumber(values.order_qty),
        weight_kg: toNullableNumber(values.weight_kg),
        trim_kg: toNullableNumber(values.trim_kg),
      }
    : {
        lot_number: '',
        order_qty: null,
        weight_kg: null,
        trim_kg: null,
      };

  return {
    department: department.code,
    entry_date: values.entry_date,
    shift: values.shift,
    operator_name: values.operator_name.trim(),
    machine_name: values.machine_name,
    job_ref: values.job_ref.trim(),
    material: values.material.trim(),
    size_spec: values.size_spec.trim(),
    qty_kg: toNumber(values.qty_kg),
    qty_meters: toNumber(values.qty_meters),
    wastage_kg: toNumber(values.wastage_kg),
    downtime_reason: values.downtime_reason,
    remarks: values.remarks.trim(),
    micron: toNullableNumber(values.micron),
    ...bag,
    ...printing,
    ...extrusion,
  };
}

export async function fetchEntriesPage({ department, search, page, pageSize }: EntryPageQuery) {
  const from = (page - 1) * pageSize;
  let query = supabase
    .from('production_entries')
    .select('*', { count: 'exact' })
    .eq('department', department);

  const term = sanitizeSearch(search);
  if (term) {
    const pattern = `*${term}*`;
    query = query.or(
      [
        `job_ref.ilike.${pattern}`,
        `material.ilike.${pattern}`,
        `size_spec.ilike.${pattern}`,
        `operator_name.ilike.${pattern}`,
        `machine_name.ilike.${pattern}`,
        `lot_number.ilike.${pattern}`,
      ].join(','),
    );
  }

  const { data, error, count } = await query
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return {
    rows: (data ?? []).map((row) => normalizeEntry(row)),
    total: count ?? 0,
  };
}

export async function fetchEntriesInRange(filter: EntryRangeFilter): Promise<ProductionEntry[]> {
  const rows: ProductionEntry[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase
      .from('production_entries')
      .select('*')
      .gte('entry_date', filter.from)
      .lte('entry_date', filter.to);

    if (filter.department) query = query.eq('department', filter.department);
    if (filter.operatorName) query = query.eq('operator_name', filter.operatorName);
    if (filter.machineName) query = query.eq('machine_name', filter.machineName);

    const { data, error } = await query
      .order('entry_date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch.map((row) => normalizeEntry(row)));
    if (batch.length < PAGE_SIZE) break;
  }

  return rows;
}

export async function insertEntry(payload: ReturnType<typeof buildEntryPayload>) {
  const { error } = await supabase.from('production_entries').insert(payload);
  if (error) throw error;
}

export async function insertEntries(payloads: ReturnType<typeof buildEntryPayload>[]) {
  for (let offset = 0; offset < payloads.length; offset += INSERT_BATCH_SIZE) {
    const batch = payloads.slice(offset, offset + INSERT_BATCH_SIZE);
    const { error } = await supabase.from('production_entries').insert(batch);
    if (error) throw error;
  }
}

export async function updateEntry(id: string, payload: ReturnType<typeof buildEntryPayload>) {
  const { data, error } = await supabase
    .from('production_entries')
    .update(payload)
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('This entry could not be updated. You may not have permission.');
}

export async function deleteEntry(id: string) {
  const { error } = await supabase.rpc('soft_delete_production_entry', { p_id: id });
  if (error) throw error;
}
