/*
# Printing production details

Plain English: adds the printing-specific measurements (micron, ink series for each colour, solvent and ethyl usage, job timings and machine speed) to production entries. Existing entries keep working; the new fields are empty for them.

1. Modified Table
- `production_entries`: new optional columns used only by the Printing department.
  - `micron` (thickness of the film in micron)
  - `ink_black_series`, `ink_cyan_series`, `ink_magenta_series`, `ink_yellow_series`, `ink_white_series`, `ink_red_series`, `ink_green_series`, `ink_blue_series`, `ink_other_series` (ink series text for each colour used)
  - `solvent_kg` and `ethyl_kg` (solvent and ethyl quantity used, in KG)
  - `start_time` and `job_approval_time` (clock times)
  - `run_minutes` (how many minutes the job ran)
  - `machine_speed` (machine speed entered by the operator)

2. Security
- No policy or grant changes. Existing row level security on `production_entries` already applies to the new columns.

3. Notes
- All text columns default to an empty string and all numeric columns allow empty values, so existing rows are not affected.
- Numeric columns reject negative values.
*/

ALTER TABLE public.production_entries
  ADD COLUMN IF NOT EXISTS micron numeric(8,2) CHECK (micron IS NULL OR micron >= 0),
  ADD COLUMN IF NOT EXISTS ink_black_series text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ink_cyan_series text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ink_magenta_series text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ink_yellow_series text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ink_white_series text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ink_red_series text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ink_green_series text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ink_blue_series text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ink_other_series text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS solvent_kg numeric(12,3) CHECK (solvent_kg IS NULL OR solvent_kg >= 0),
  ADD COLUMN IF NOT EXISTS ethyl_kg numeric(12,3) CHECK (ethyl_kg IS NULL OR ethyl_kg >= 0),
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS job_approval_time time,
  ADD COLUMN IF NOT EXISTS run_minutes integer CHECK (run_minutes IS NULL OR run_minutes >= 0),
  ADD COLUMN IF NOT EXISTS machine_speed numeric(10,2) CHECK (machine_speed IS NULL OR machine_speed >= 0);
