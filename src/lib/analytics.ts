import { DEPARTMENT_CODES, type DepartmentCode } from '@/lib/constants';
import type { ProductionEntry } from '@/lib/types';

export interface EntryTotals {
  count: number;
  qtyKg: number;
  qtyMeters: number;
  wastageKg: number;
  wastagePct: number;
}

export function sumEntries(entries: ProductionEntry[]): EntryTotals {
  const totals = entries.reduce(
    (acc, entry) => {
      acc.count += 1;
      acc.qtyKg += entry.qty_kg;
      acc.qtyMeters += entry.qty_meters;
      acc.wastageKg += entry.wastage_kg;
      return acc;
    },
    { count: 0, qtyKg: 0, qtyMeters: 0, wastageKg: 0 },
  );
  const processed = totals.qtyKg + totals.wastageKg;
  return {
    ...totals,
    wastagePct: processed > 0 ? (totals.wastageKg / processed) * 100 : 0,
  };
}

export function groupByDepartment(entries: ProductionEntry[]): Record<DepartmentCode, EntryTotals> {
  const grouped = {} as Record<DepartmentCode, EntryTotals>;
  for (const code of DEPARTMENT_CODES) {
    grouped[code] = sumEntries(entries.filter((entry) => entry.department === code));
  }
  return grouped;
}
