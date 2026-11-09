/*
# Ink usage per colour and Extrusion department

Plain English: adds a new Extrusion department with its own machines and fields, and stores ink usage for every ink colour (series, received, returned, and used). Existing entries are not changed.

1. Modified Tables
- `production_entries` and `machines`: the department list now also accepts `extrusion`.
- `production_entries`: new columns
  - `lot_number` (Extrusion lot number)
  - `order_qty`, `weight_kg`, `trim_kg` (Extrusion quantities)
  - `ink_usage` (JSON object holding series, received KG and returned KG for each ink colour; used KG is received minus returned and is calculated when shown)
- `machines`: six Extrusion machines added (Machine 1 to Machine 6).

2. Security
- No policy or grant changes. Existing row level security already covers the new columns.

3. Important notes
- Removing columns needs your approval, so the per-colour ink series columns added in the previous migration are left in place and are no longer used by the app.
- Constraints are dropped and recreated so the new department value is accepted. This does not change any existing data.
*/

ALTER TABLE public.production_entries DROP CONSTRAINT IF EXISTS production_entries_department_check;
ALTER TABLE public.production_entries ADD CONSTRAINT production_entries_department_check CHECK (department IN (
  'extrusion', 'printing', 'solventless', 'dry_lamination', 'bag_making', 'pvc_cutting',
  'pvc_center_seal', 'slitting', 'rewinding', 'print_rewinding'
));

ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS machines_department_check;
ALTER TABLE public.machines ADD CONSTRAINT machines_department_check CHECK (department IN (
  'extrusion', 'printing', 'solventless', 'dry_lamination', 'bag_making', 'pvc_cutting',
  'pvc_center_seal', 'slitting', 'rewinding', 'print_rewinding'
));

ALTER TABLE public.production_entries
  ADD COLUMN IF NOT EXISTS lot_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS order_qty numeric(12,3) CHECK (order_qty IS NULL OR order_qty >= 0),
  ADD COLUMN IF NOT EXISTS weight_kg numeric(12,3) CHECK (weight_kg IS NULL OR weight_kg >= 0),
  ADD COLUMN IF NOT EXISTS trim_kg numeric(12,3) CHECK (trim_kg IS NULL OR trim_kg >= 0),
  ADD COLUMN IF NOT EXISTS ink_usage jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(ink_usage) = 'object');

INSERT INTO public.machines (department, name) VALUES
  ('extrusion', 'Machine 1'),
  ('extrusion', 'Machine 2'),
  ('extrusion', 'Machine 3'),
  ('extrusion', 'Machine 4'),
  ('extrusion', 'Machine 5'),
  ('extrusion', 'Machine 6')
ON CONFLICT (department, name) DO NOTHING;
