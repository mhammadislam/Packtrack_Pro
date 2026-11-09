import type { DepartmentCode, InkKey } from '@/lib/constants';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'operator';
  status: 'pending_approval' | 'active' | 'rejected';
  is_suspended: boolean;
  can_delete_entries: boolean;
  can_view_reports: boolean;
}

export interface Operator {
  id: string;
  name: string;
}

export interface Machine {
  id: string;
  department: DepartmentCode;
  name: string;
}

export type Shift = 'Day' | 'Night' | 'A' | 'B';
export type DowntimeReason = 'No Issue' | 'Power Failure' | 'Machine Issue' | 'Material Issue' | 'Other';
export type BagType = '3 Side Seal' | '4 Side Seal';
export type PunchZipper = 'None' | 'Punch' | 'Zipper';

export type InkPart = 'series' | 'received' | 'returned' | 'used';
export type InkFormValues = Record<`ink_${InkKey}_${InkPart}`, string>;

export interface InkUsageItem {
  series: string;
  received_kg: number;
  returned_kg: number;
}

export type InkUsage = Partial<Record<InkKey, InkUsageItem>>;

export type EntryFormValues = InkFormValues & {
  entry_date: string;
  shift: Shift;
  operator_name: string;
  machine_name: string;
  job_ref: string;
  material: string;
  size_spec: string;
  qty_kg: string;
  qty_meters: string;
  wastage_kg: string;
  downtime_reason: DowntimeReason;
  remarks: string;
  bag_length: string;
  bag_width: string;
  bag_type: BagType | '';
  total_pcs: string;
  punch_zipper: PunchZipper;
  micron: string;
  solvent_kg: string;
  ethyl_kg: string;
  start_time: string;
  job_approval_time: string;
  run_minutes: string;
  machine_speed: string;
  lot_number: string;
  order_qty: string;
  weight_kg: string;
  trim_kg: string;
};

export interface ProductionEntry {
  id: string;
  department: DepartmentCode;
  entry_date: string;
  shift: Shift;
  operator_name: string;
  machine_name: string;
  job_ref: string;
  material: string;
  size_spec: string;
  qty_kg: number;
  qty_meters: number;
  wastage_kg: number;
  downtime_reason: DowntimeReason;
  remarks: string;
  bag_length: number | null;
  bag_width: number | null;
  bag_type: BagType | null;
  total_pcs: number | null;
  punch_zipper: PunchZipper | null;
  micron: number | null;
  ink_usage: InkUsage;
  solvent_kg: number | null;
  ethyl_kg: number | null;
  start_time: string;
  job_approval_time: string;
  run_minutes: number | null;
  machine_speed: number | null;
  lot_number: string;
  order_qty: number | null;
  weight_kg: number | null;
  trim_kg: number | null;
  created_by: string | null;
  created_at: string;
}
