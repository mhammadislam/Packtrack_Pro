import { BAG_TYPES, DOWNTIME_REASONS, INK_COLORS, INK_SERIES, PRINTING_SHIFTS, PUNCH_ZIPPER_OPTIONS, SHIFTS, type DepartmentConfig } from '@/lib/constants';
import type { EntryFormValues } from '@/lib/types';

export type EntryColumnKind = 'text' | 'number' | 'date' | 'clock' | 'choice';

type ColumnScope = 'all' | 'standard' | 'nonPrinting' | 'bag' | 'printing' | 'extrusion';

export interface EntryColumn {
  field: keyof EntryFormValues;
  header: string;
  kind: EntryColumnKind;
  scope: readonly ColumnScope[];
  options?: readonly string[];
  derived?: boolean;
}

const INK_COLUMNS = INK_COLORS.flatMap((color): EntryColumn[] => [
  { field: `ink_${color.key}_series` as keyof EntryFormValues, header: `${color.label} Ink Series`, kind: 'choice', scope: ['printing'], options: INK_SERIES },
  { field: `ink_${color.key}_received` as keyof EntryFormValues, header: `${color.label} Received (KG)`, kind: 'number', scope: ['printing'] },
  { field: `ink_${color.key}_returned` as keyof EntryFormValues, header: `${color.label} Returned (KG)`, kind: 'number', scope: ['printing'] },
  { field: `ink_${color.key}_used` as keyof EntryFormValues, header: `${color.label} Used (KG)`, kind: 'number', scope: ['printing'], derived: true },
]);

export const ENTRY_COLUMNS: EntryColumn[] = [
  { field: 'entry_date', header: 'Date', kind: 'date', scope: ['all'] },
  { field: 'shift', header: 'Shift', kind: 'choice', scope: ['nonPrinting'], options: SHIFTS },
  { field: 'shift', header: 'Shift', kind: 'choice', scope: ['printing'], options: PRINTING_SHIFTS },
  { field: 'operator_name', header: 'Operator', kind: 'text', scope: ['all'] },
  { field: 'machine_name', header: 'Machine', kind: 'text', scope: ['standard'] },
  { field: 'job_ref', header: 'Job Card / Customer', kind: 'text', scope: ['nonPrinting'] },
  { field: 'job_ref', header: 'Order Number', kind: 'text', scope: ['printing'] },
  { field: 'material', header: 'Material / Film', kind: 'text', scope: ['all'] },
  { field: 'lot_number', header: 'Lot Number', kind: 'text', scope: ['extrusion'] },
  { field: 'micron', header: 'Micron', kind: 'number', scope: ['printing', 'extrusion'] },
  { field: 'size_spec', header: 'Size / Spec', kind: 'text', scope: ['all'] },
  { field: 'order_qty', header: 'Order Qty', kind: 'number', scope: ['extrusion'] },
  { field: 'qty_kg', header: 'Production (KG)', kind: 'number', scope: ['standard'] },
  { field: 'weight_kg', header: 'Weight (KG)', kind: 'number', scope: ['extrusion'] },
  { field: 'trim_kg', header: 'Trim (KG)', kind: 'number', scope: ['extrusion'] },
  { field: 'qty_meters', header: 'Production (Meters)', kind: 'number', scope: ['standard'] },
  { field: 'wastage_kg', header: 'Wastage (KG)', kind: 'number', scope: ['all'] },
  { field: 'downtime_reason', header: 'Downtime Reason', kind: 'choice', scope: ['standard'], options: DOWNTIME_REASONS },
  { field: 'remarks', header: 'Remarks', kind: 'text', scope: ['standard'] },
  { field: 'bag_length', header: 'Bag Length', kind: 'number', scope: ['bag'] },
  { field: 'bag_width', header: 'Bag Width', kind: 'number', scope: ['bag'] },
  { field: 'bag_type', header: 'Bag Type', kind: 'choice', scope: ['bag'], options: BAG_TYPES },
  { field: 'total_pcs', header: 'Total Pcs', kind: 'number', scope: ['bag'] },
  { field: 'punch_zipper', header: 'Punch / Zipper', kind: 'choice', scope: ['bag'], options: PUNCH_ZIPPER_OPTIONS },
  ...INK_COLUMNS,
  { field: 'solvent_kg', header: 'Solvent (KG)', kind: 'number', scope: ['printing'] },
  { field: 'ethyl_kg', header: 'Ethyl (KG)', kind: 'number', scope: ['printing'] },
  { field: 'start_time', header: 'Start Time', kind: 'clock', scope: ['printing'] },
  { field: 'job_approval_time', header: 'Job Approval Time', kind: 'clock', scope: ['printing'] },
  { field: 'run_minutes', header: 'Run Time (Minutes)', kind: 'number', scope: ['printing'] },
  { field: 'machine_speed', header: 'Machine Speed', kind: 'number', scope: ['printing'] },
];

function appliesTo(scope: ColumnScope, department: DepartmentConfig): boolean {
  switch (scope) {
    case 'all':
      return true;
    case 'standard':
      return !department.hasExtrusionFields;
    case 'nonPrinting':
      return !department.hasExtrusionFields && !department.hasPrintingFields;
    case 'bag':
      return department.hasBagFields;
    case 'printing':
      return department.hasPrintingFields;
    case 'extrusion':
      return department.hasExtrusionFields;
  }
}

export function columnsForDepartment(department: DepartmentConfig): EntryColumn[] {
  return ENTRY_COLUMNS.filter((column) => column.scope.some((scope) => appliesTo(scope, department)));
}
