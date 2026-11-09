import { supabase } from '@/lib/supabase';
import { sanitizeSearch } from '@/lib/entries';
import { addDaysISO, todayISO } from '@/lib/dates';

export const QC_ATTACHMENT_BUCKET = 'qc-attachments';
export const QC_SHIFTS = ['A', 'B', 'C'] as const;
export const QC_DEFECT_TYPES = ['Printing Shade', 'Wrinkle', 'Loose Sealing', 'Cutting Issue', 'Ink Smudging'] as const;
export const QC_STATUSES = ['Approved', 'Hold', 'Rejected'] as const;
export const QC_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const QC_IMAGE_EXTENSIONS: Partial<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const QC_NUMERIC_PARAMETERS = [
  { key: 'gsm_check', label: 'GSM Check', unit: 'g/m²' },
  { key: 'micron', label: 'Micrometer (Micron)', unit: 'µm' },
  { key: 'seal_strength_n', label: 'Seal Strength', unit: 'N/15mm' },
  { key: 'lamination_bond_strength', label: 'Lamination Bond Strength', unit: 'N/15mm' },
  { key: 'corona_dyne', label: 'Corona Treatment', unit: 'dyne' },
  { key: 'color_delta_e', label: 'Color Matching', unit: 'Delta E' },
] as const;

export const QC_RESULT_PARAMETERS = [
  { key: 'peel_test', label: 'Peeling Test' },
  { key: 'registration_check', label: 'Printing Registration Check' },
  { key: 'bag_check', label: 'Bag Size & Weight Check' },
  { key: 'leak_test', label: 'Leak Test' },
] as const;

export type QcShift = (typeof QC_SHIFTS)[number];
export type QcDefectType = (typeof QC_DEFECT_TYPES)[number];
export type QcStatus = (typeof QC_STATUSES)[number];
export type QcResult = 'Pass' | 'Fail';
export type QcGrade = 'A' | 'B' | 'Rejected';
export type QcNumericKey = (typeof QC_NUMERIC_PARAMETERS)[number]['key'];
export type QcResultKey = (typeof QC_RESULT_PARAMETERS)[number]['key'];

export interface QcReport extends Record<QcNumericKey, number | null>, Record<QcResultKey, QcResult | null> {
  id: string;
  report_no: string;
  report_date: string;
  shift: QcShift;
  machine_no: string;
  operator_name: string;
  job_card_no: string;
  customer_name: string;
  film_structure: string;
  sample_qty: number;
  defective_qty: number;
  defect_type: QcDefectType | null;
  defect_pct: number;
  grade: QcGrade;
  status: QcStatus;
  defect_image_path: string | null;
  signature_data: string | null;
  officer_name: string;
  notes: string;
  created_by: string | null;
  created_at: string;
}

export type QcPayload = Omit<QcReport, 'id' | 'report_no' | 'defect_pct' | 'grade' | 'created_by' | 'created_at'>;

export interface QcFormValues {
  report_date: string;
  shift: QcShift | '';
  machine_no: string;
  operator_name: string;
  job_card_no: string;
  customer_name: string;
  film_structure: string;
  numeric: Record<QcNumericKey, string>;
  results: Record<QcResultKey, QcResult | ''>;
  sample_qty: string;
  defective_qty: string;
  defect_type: QcDefectType | '';
  status: QcStatus;
  officer_name: string;
  notes: string;
  signature_data: string | null;
}

export interface QcFilter {
  search: string;
  from: string;
  to: string;
  customer: string;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toResult(value: unknown): QcResult | null {
  return value === 'Pass' || value === 'Fail' ? value : null;
}

export function gradeForCounts(sampleQty: number, defectiveQty: number): QcGrade {
  const ratio = (defectiveQty / sampleQty) * 100;
  if (ratio < 2) return 'A';
  if (ratio <= 5) return 'B';
  return 'Rejected';
}

export function defectPercent(sampleQty: number, defectiveQty: number): number {
  return Math.round((defectiveQty / sampleQty) * 10000) / 100;
}

export function statusForGrade(grade: QcGrade): QcStatus {
  return grade === 'Rejected' ? 'Rejected' : 'Approved';
}

export function normalizeQcReport(row: Record<string, unknown>): QcReport {
  const numeric = Object.fromEntries(
    QC_NUMERIC_PARAMETERS.map(({ key }) => [key, toNullableNumber(row[key])]),
  ) as Record<QcNumericKey, number | null>;
  const results = Object.fromEntries(
    QC_RESULT_PARAMETERS.map(({ key }) => [key, toResult(row[key])]),
  ) as Record<QcResultKey, QcResult | null>;

  return {
    id: String(row.id),
    report_no: String(row.report_no ?? ''),
    report_date: String(row.report_date),
    shift: row.shift as QcShift,
    machine_no: String(row.machine_no ?? ''),
    operator_name: String(row.operator_name ?? ''),
    job_card_no: String(row.job_card_no ?? ''),
    customer_name: String(row.customer_name ?? ''),
    film_structure: String(row.film_structure ?? ''),
    ...numeric,
    ...results,
    sample_qty: toNumber(row.sample_qty),
    defective_qty: toNumber(row.defective_qty),
    defect_type: (row.defect_type as QcDefectType | null) ?? null,
    defect_pct: toNumber(row.defect_pct),
    grade: row.grade as QcGrade,
    status: row.status as QcStatus,
    defect_image_path: (row.defect_image_path as string | null) ?? null,
    signature_data: (row.signature_data as string | null) ?? null,
    officer_name: String(row.officer_name ?? ''),
    notes: String(row.notes ?? ''),
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at),
  };
}

export function qcFormValuesEmpty(): QcFormValues {
  return {
    report_date: todayISO(),
    shift: '',
    machine_no: '',
    operator_name: '',
    job_card_no: '',
    customer_name: '',
    film_structure: '',
    numeric: Object.fromEntries(QC_NUMERIC_PARAMETERS.map(({ key }) => [key, ''])) as Record<QcNumericKey, string>,
    results: Object.fromEntries(QC_RESULT_PARAMETERS.map(({ key }) => [key, ''])) as Record<QcResultKey, '' | QcResult>,
    sample_qty: '',
    defective_qty: '0',
    defect_type: '',
    status: 'Hold',
    officer_name: '',
    notes: '',
    signature_data: null,
  };
}

export function qcFormValuesFromReport(report: QcReport): QcFormValues {
  return {
    report_date: report.report_date,
    shift: report.shift,
    machine_no: report.machine_no,
    operator_name: report.operator_name,
    job_card_no: report.job_card_no,
    customer_name: report.customer_name,
    film_structure: report.film_structure,
    numeric: Object.fromEntries(
      QC_NUMERIC_PARAMETERS.map(({ key }) => [key, report[key] === null ? '' : String(report[key])]),
    ) as Record<QcNumericKey, string>,
    results: Object.fromEntries(QC_RESULT_PARAMETERS.map(({ key }) => [key, report[key] ?? ''])) as Record<QcResultKey, '' | QcResult>,
    sample_qty: String(report.sample_qty),
    defective_qty: String(report.defective_qty),
    defect_type: report.defect_type ?? '',
    status: report.status,
    officer_name: report.officer_name,
    notes: report.notes,
    signature_data: report.signature_data,
  };
}

export function validateQcForm(values: QcFormValues): string | null {
  const required: [string, string][] = [
    ['Date', values.report_date],
    ['Machine No', values.machine_no],
    ['Operator Name', values.operator_name],
    ['Job Card No', values.job_card_no],
    ['Customer Name', values.customer_name],
    ['Film Structure', values.film_structure],
  ];
  for (const [label, value] of required) {
    if (!value.trim()) return `${label} is required.`;
  }
  if (!values.shift) return 'Shift is required.';

  const sample = Number(values.sample_qty);
  if (!Number.isInteger(sample) || sample <= 0) return 'Sample quantity must be a whole number greater than zero.';
  const defective = Number(values.defective_qty);
  if (!Number.isInteger(defective) || defective < 0) return 'Defective quantity must be a whole number, zero or more.';
  if (defective > sample) return 'Defective quantity cannot be more than the sample quantity.';

  for (const { key, label } of QC_NUMERIC_PARAMETERS) {
    const raw = values.numeric[key].trim();
    if (raw !== '' && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) {
      return `${label} must be a number, zero or more.`;
    }
  }
  return null;
}

export function buildQcPayload(values: QcFormValues, defectImagePath: string | null): QcPayload {
  const numeric = Object.fromEntries(
    QC_NUMERIC_PARAMETERS.map(({ key }) => [key, toNullableNumber(values.numeric[key])]),
  ) as Record<QcNumericKey, number | null>;
  const results = Object.fromEntries(
    QC_RESULT_PARAMETERS.map(({ key }) => [key, values.results[key] || null]),
  ) as Record<QcResultKey, QcResult | null>;

  return {
    report_date: values.report_date,
    shift: values.shift as QcShift,
    machine_no: values.machine_no.trim(),
    operator_name: values.operator_name.trim(),
    job_card_no: values.job_card_no.trim(),
    customer_name: values.customer_name.trim(),
    film_structure: values.film_structure.trim(),
    ...numeric,
    ...results,
    sample_qty: Math.trunc(toNumber(values.sample_qty)),
    defective_qty: Math.trunc(toNumber(values.defective_qty)),
    defect_type: values.defect_type || null,
    status: values.status,
    defect_image_path: defectImagePath,
    signature_data: values.signature_data,
    officer_name: values.officer_name.trim(),
    notes: values.notes.trim(),
  };
}

export function validateQcImage(file: File): string | null {
  if (!QC_IMAGE_EXTENSIONS[file.type]) return 'Upload a JPG, PNG or WebP image.';
  if (file.size > QC_MAX_IMAGE_BYTES) return 'Images must be 5 MB or smaller.';
  return null;
}

export function qcAttachmentUrl(path: string): string {
  return supabase.storage.from(QC_ATTACHMENT_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function qcQrText(report: QcReport): string {
  return `${report.report_no} | ${report.customer_name} | Job ${report.job_card_no} | Grade ${report.grade} | ${report.status} | ${report.report_date}`;
}

export async function fetchQcReports(filter: QcFilter): Promise<QcReport[]> {
  let query = supabase
    .from('qc_reports')
    .select('*')
    .gte('report_date', filter.from)
    .lte('report_date', filter.to);

  if (filter.customer) query = query.eq('customer_name', filter.customer);

  const term = sanitizeSearch(filter.search);
  if (term) {
    const pattern = `*${term}*`;
    query = query.or(
      [
        `report_no.ilike.${pattern}`,
        `job_card_no.ilike.${pattern}`,
        `customer_name.ilike.${pattern}`,
        `machine_no.ilike.${pattern}`,
        `operator_name.ilike.${pattern}`,
      ].join(','),
    );
  }

  const { data, error } = await query
    .order('report_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) throw error;
  return (data ?? []).map((row) => normalizeQcReport(row));
}

export async function fetchQcCustomers(): Promise<string[]> {
  const { data, error } = await supabase
    .from('qc_reports')
    .select('customer_name')
    .order('customer_name', { ascending: true })
    .limit(5000);
  if (error) throw error;
  const names = new Set((data ?? []).map((row) => String(row.customer_name ?? '').trim()).filter(Boolean));
  return [...names];
}

export function defaultQcFilter(): QcFilter {
  const today = todayISO();
  return { search: '', from: addDaysISO(today, -30), to: today, customer: '' };
}

export async function insertQcReport(payload: QcPayload) {
  const { error } = await supabase.from('qc_reports').insert(payload);
  if (error) throw error;
}

export async function updateQcReport(id: string, payload: QcPayload) {
  const { data, error } = await supabase.from('qc_reports').update(payload).eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('This report could not be updated. You may not have permission.');
}

export async function deleteQcReport(id: string) {
  const { error } = await supabase.rpc('soft_delete_qc_report', { p_id: id });
  if (error) throw error;
}

export async function uploadQcDefectImage(file: File): Promise<string> {
  const extension = QC_IMAGE_EXTENSIONS[file.type];
  if (!extension) throw new Error('Upload a JPG, PNG or WebP image.');
  const path = `defects/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(QC_ATTACHMENT_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}
