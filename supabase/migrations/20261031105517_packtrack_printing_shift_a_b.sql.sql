/*
# Allow shifts A and B

1. Modified Tables
- `production_entries`: the shift check now also accepts 'A' and 'B', which the Printing department uses alongside Day and Night.

2. Security
- No change to row level security, policies, or grants.

3. Important Notes
- Existing rows are unaffected; only the allowed values grow.
- The constraint is replaced idempotently: it is dropped if present and recreated with the wider list.
*/

ALTER TABLE production_entries DROP CONSTRAINT IF EXISTS production_entries_shift_check;

ALTER TABLE production_entries
  ADD CONSTRAINT production_entries_shift_check
  CHECK (shift IN ('Day', 'Night', 'A', 'B'));
