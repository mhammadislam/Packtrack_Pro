import type { DepartmentCode } from '@/lib/constants';

export type Page =
  | { kind: 'dashboard' }
  | { kind: 'department'; code: DepartmentCode }
  | { kind: 'reports' }
  | { kind: 'qc' }
  | { kind: 'operators' }
  | { kind: 'machines' }
  | { kind: 'users' }
  | { kind: 'inventory' }
  | { kind: 'dispatch' }
  | { kind: 'trash' };
