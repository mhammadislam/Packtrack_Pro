import { todayISO } from '@/lib/dates';
import { EXTRUSION_MATERIALS, INK_COLORS, type DepartmentConfig } from '@/lib/constants';
import type { EntryFormValues, InkFormValues, InkUsage, ProductionEntry } from '@/lib/types';

export type FormErrors = Partial<Record<keyof EntryFormValues, string>>;

export function inkUsedText(received: string, returned: string): string {
  if (received.trim() === '' && returned.trim() === '') return '';
  const used = Number(received || 0) - Number(returned || 0);
  return String(Math.round(used * 1000) / 1000);
}

function inkFormValues(usage: InkUsage): InkFormValues {
  const values = {} as InkFormValues;
  for (const { key } of INK_COLORS) {
    const item = usage[key];
    const received = item ? String(item.received_kg) : '';
    const returned = item ? String(item.returned_kg) : '';
    values[`ink_${key}_series` as const] = item?.series ?? '';
    values[`ink_${key}_received` as const] = received;
    values[`ink_${key}_returned` as const] = returned;
    values[`ink_${key}_used` as const] = item ? inkUsedText(received, returned) : '';
  }
  return values;
}

export function emptyValues(): EntryFormValues {
  return {
    entry_date: todayISO(),
    shift: 'Day',
    operator_name: '',
    machine_name: '',
    job_ref: '',
    material: '',
    size_spec: '',
    qty_kg: '',
    qty_meters: '',
    wastage_kg: '',
    downtime_reason: 'No Issue',
    remarks: '',
    bag_length: '',
    bag_width: '',
    bag_type: '',
    total_pcs: '',
    punch_zipper: 'None',
    micron: '',
    solvent_kg: '',
    ethyl_kg: '',
    start_time: '',
    job_approval_time: '',
    run_minutes: '',
    machine_speed: '',
    lot_number: '',
    order_qty: '',
    weight_kg: '',
    trim_kg: '',
    ...inkFormValues({}),
  };
}

export function valuesFromEntry(entry: ProductionEntry): EntryFormValues {
  const text = (value: number | null) => (value === null ? '' : String(value));
  return {
    entry_date: entry.entry_date,
    shift: entry.shift,
    operator_name: entry.operator_name,
    machine_name: entry.machine_name,
    job_ref: entry.job_ref,
    material: entry.material,
    size_spec: entry.size_spec,
    qty_kg: String(entry.qty_kg),
    qty_meters: String(entry.qty_meters),
    wastage_kg: String(entry.wastage_kg),
    downtime_reason: entry.downtime_reason,
    remarks: entry.remarks,
    bag_length: text(entry.bag_length),
    bag_width: text(entry.bag_width),
    bag_type: entry.bag_type ?? '',
    total_pcs: text(entry.total_pcs),
    punch_zipper: entry.punch_zipper ?? 'None',
    micron: text(entry.micron),
    solvent_kg: text(entry.solvent_kg),
    ethyl_kg: text(entry.ethyl_kg),
    start_time: entry.start_time,
    job_approval_time: entry.job_approval_time,
    run_minutes: text(entry.run_minutes),
    machine_speed: text(entry.machine_speed),
    lot_number: entry.lot_number,
    order_qty: text(entry.order_qty),
    weight_kg: text(entry.weight_kg),
    trim_kg: text(entry.trim_kg),
    ...inkFormValues(entry.ink_usage),
  };
}

function isNonNegativeNumber(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
}

export function validate(values: EntryFormValues, department: DepartmentConfig): FormErrors {
  const errors: FormErrors = {};
  if (!values.entry_date) errors.entry_date = 'Select the production date.';
  if (!values.operator_name.trim()) errors.operator_name = 'Select or add an operator.';

  const numericFields: (keyof EntryFormValues)[] = ['wastage_kg'];
  if (!values.machine_name) errors.machine_name = 'Select a machine.';
  if (!department.hasExtrusionFields) {
    if (!values.job_ref.trim()) {
      errors.job_ref = department.hasPrintingFields ? 'Enter the order number.' : 'Enter the job card number or customer name.';
    }
    numericFields.push('qty_kg', 'qty_meters');
  }
  if (department.hasPrintingFields) {
    numericFields.push('micron', 'solvent_kg', 'ethyl_kg', 'run_minutes', 'machine_speed');
    for (const { key } of INK_COLORS) numericFields.push(`ink_${key}_received`, `ink_${key}_returned`);
  }
  if (department.hasExtrusionFields) {
    numericFields.push('micron', 'order_qty', 'weight_kg', 'trim_kg');
    if (!EXTRUSION_MATERIALS.some((material) => material === values.material)) {
      errors.material = 'Select a material from the list.';
    }
    if (!values.lot_number.trim()) errors.lot_number = 'Enter the lot number.';
  }
  for (const field of numericFields) {
    const raw = values[field];
    if (raw.trim() !== '' && !isNonNegativeNumber(raw)) errors[field] = 'Enter a number of zero or more.';
  }

  if (department.hasPrintingFields) {
    for (const { key } of INK_COLORS) {
      const returned = values[`ink_${key}_returned` as const];
      const received = values[`ink_${key}_received` as const];
      if (isNonNegativeNumber(returned) && Number(returned) > Number(received || 0)) {
        errors[`ink_${key}_returned` as const] = 'Returned cannot be more than received.';
      }
    }
  }

  if (!department.hasExtrusionFields && !(Number(values.qty_kg) > 0 || Number(values.qty_meters) > 0)) {
    errors.qty_kg = 'Enter the production in KG or meters.';
  }

  if (department.hasBagFields) {
    if (!values.bag_length || !isNonNegativeNumber(values.bag_length)) errors.bag_length = 'Enter the bag length.';
    if (!values.bag_width || !isNonNegativeNumber(values.bag_width)) errors.bag_width = 'Enter the bag width.';
    if (!values.bag_type) errors.bag_type = 'Select the bag type.';
    if (!values.total_pcs || !isNonNegativeNumber(values.total_pcs)) errors.total_pcs = 'Enter the total pieces.';
  }

  return errors;
}
