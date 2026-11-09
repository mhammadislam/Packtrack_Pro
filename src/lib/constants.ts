import type { LucideIcon } from 'lucide-react';
import {
  Columns,
  Droplets,
  Factory,
  Layers,
  Printer,
  Repeat,
  RotateCw,
  Ruler,
  Scissors,
  ShoppingBag,
} from 'lucide-react';

export const DEPARTMENT_CODES = [
  'extrusion',
  'printing',
  'solventless',
  'dry_lamination',
  'bag_making',
  'pvc_cutting',
  'pvc_center_seal',
  'slitting',
  'rewinding',
  'print_rewinding',
] as const;

export type DepartmentCode = (typeof DEPARTMENT_CODES)[number];

export interface DepartmentConfig {
  code: DepartmentCode;
  name: string;
  shortName: string;
  icon: LucideIcon;
  hasBagFields: boolean;
  hasPrintingFields: boolean;
  hasExtrusionFields: boolean;
}

export const DEPARTMENTS: DepartmentConfig[] = [
  { code: 'extrusion', name: 'Extrusion Department', shortName: 'Extrusion', icon: Factory, hasBagFields: false, hasPrintingFields: false, hasExtrusionFields: true },
  { code: 'printing', name: 'Printing Department', shortName: 'Printing', icon: Printer, hasBagFields: false, hasPrintingFields: true, hasExtrusionFields: false },
  { code: 'solventless', name: 'Solvent Less Department', shortName: 'Solvent Less', icon: Droplets, hasBagFields: false, hasPrintingFields: false, hasExtrusionFields: false },
  { code: 'dry_lamination', name: 'Dry Lamination Department', shortName: 'Dry Lamination', icon: Layers, hasBagFields: false, hasPrintingFields: false, hasExtrusionFields: false },
  { code: 'bag_making', name: 'Bag Making Department', shortName: 'Bag Making', icon: ShoppingBag, hasBagFields: true, hasPrintingFields: false, hasExtrusionFields: false },
  { code: 'pvc_cutting', name: 'PVC Cutting Department', shortName: 'PVC Cutting', icon: Scissors, hasBagFields: false, hasPrintingFields: false, hasExtrusionFields: false },
  { code: 'pvc_center_seal', name: 'PVC Center Seal Department', shortName: 'PVC Center Seal', icon: Columns, hasBagFields: false, hasPrintingFields: false, hasExtrusionFields: false },
  { code: 'slitting', name: 'Slitting Department', shortName: 'Slitting', icon: Ruler, hasBagFields: false, hasPrintingFields: false, hasExtrusionFields: false },
  { code: 'rewinding', name: 'Rewinding Department', shortName: 'Rewinding', icon: RotateCw, hasBagFields: false, hasPrintingFields: false, hasExtrusionFields: false },
  { code: 'print_rewinding', name: 'Print Rewinding Department', shortName: 'Print Rewinding', icon: Repeat, hasBagFields: false, hasPrintingFields: false, hasExtrusionFields: false },
];

export const DEPARTMENT_BY_CODE = Object.fromEntries(
  DEPARTMENTS.map((department) => [department.code, department]),
) as Record<DepartmentCode, DepartmentConfig>;

export const SHIFTS = ['Day', 'Night'] as const;

export const PRINTING_SHIFTS = ['Day', 'Night', 'A', 'B'] as const;

export const DOWNTIME_REASONS = ['No Issue', 'Power Failure', 'Machine Issue', 'Material Issue', 'Other'] as const;

export const BAG_TYPES = ['3 Side Seal', '4 Side Seal'] as const;

export const PUNCH_ZIPPER_OPTIONS = ['None', 'Punch', 'Zipper'] as const;

export const INK_COLORS = [
  { key: 'blue', label: 'Blue' },
  { key: 'brown', label: 'Brown' },
  { key: 'pink', label: 'Pink' },
  { key: 'violet', label: 'Violet' },
  { key: 'green', label: 'Green' },
  { key: 'black', label: 'Black' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'red', label: 'Red' },
  { key: 'cyan', label: 'Cyan' },
  { key: 'magenta', label: 'Magenta' },
  { key: 'white', label: 'White' },
  { key: 'medium', label: 'Medium' },
  { key: 'purple', label: 'Purple' },
  { key: 'orange', label: 'Orange' },
  { key: 'silver', label: 'Silver' },
  { key: 'gold', label: 'Gold' },
  { key: 'sp_khaki', label: 'Sp Khaki' },
  { key: 'sp_green', label: 'Sp Green' },
  { key: 'maroon', label: 'Maroon' },
  { key: 'grey', label: 'Grey' },
] as const;

export type InkKey = (typeof INK_COLORS)[number]['key'];

export const INK_SERIES = [
  'Hikari', 'USL', 'Pinnacle', 'Capital', 'ELB', 'MPV', 'EPV', 'FLASH', 'Xlam', 'RT', 'Siegwerk', 'Sunex', 'GPL', 'DIC',
] as const;

export const EXTRUSION_MATERIALS = [
  'PE(N)', 'PE(M)', 'PE(N)HD', 'PE(M)HD', 'PE(N) Blue', 'PE(N) BLACK', 'PE(N) LD', 'PE(M) LD',
] as const;

export const ROLES = ['admin', 'operator'] as const;
