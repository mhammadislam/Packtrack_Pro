/*
# PVC Cutting Department module

1. New Table
- `pvc_cutting`: one row per cutting lot.
  - Lot number (unique among active entries), date, operator, job name, description, cutting size in mm.
  - Total in weight, balance weight, wastage (kg).
  - Start and end time.
- Calculated by the database on every save (so the values cannot be forged from the browser):
  - Out weight = total in weight minus balance weight.
  - Wastage percent = wastage / total in weight * 100.
  - Total time = end time minus start time, handling shifts that run past midnight.
- Soft delete columns `deleted_at` and `deleted_by`. Deleted entries move to the Trash.

2. Helper
- `private.is_approved_user()`: true when the signed-in user is active and not suspended.
- `private.format_minutes(integer)`: formats minutes as "2h 30m".

3. Security
- Row-level security enabled on `pvc_cutting`.
- Approved and active users can view active entries and add new ones.
- Only administrators can edit entries.
- Direct deletes are revoked. Administrators delete through `soft_delete_pvc_cutting`, restore through `restore_pvc_cutting`, and remove permanently through `purge_pvc_cutting`.
- Administrators can see deleted entries so they can be restored from the Trash.

4. Notes
- Column-level grants restrict writes to the form fields. Calculated columns and deletion fields are never client-writable.
*/

CREATE OR REPLACE FUNCTION private.is_approved_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.profiles AS p
  WHERE p.id = auth.uid() AND p.status = 'active' AND NOT p.is_suspended
);
$$;

REVOKE EXECUTE ON FUNCTION private.is_approved_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_approved_user() TO authenticated;

CREATE OR REPLACE FUNCTION private.format_minutes(p_minutes integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
SELECT format('%sh %sm', p_minutes / 60, p_minutes % 60);
$$;

CREATE TABLE IF NOT EXISTS pvc_cutting (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_number text NOT NULL CHECK (char_length(btrim(lot_number)) > 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  operator_name text NOT NULL CHECK (char_length(btrim(operator_name)) > 0),
  job_name text NOT NULL CHECK (char_length(btrim(job_name)) > 0),
  description text NOT NULL DEFAULT '',
  cutting_size_mm text NOT NULL CHECK (char_length(btrim(cutting_size_mm)) > 0),
  total_in_weight_kg numeric(12,3) NOT NULL CHECK (total_in_weight_kg > 0),
  balance_weight_kg numeric(12,3) NOT NULL CHECK (balance_weight_kg >= 0 AND balance_weight_kg <= total_in_weight_kg),
  out_weight_kg numeric(12,3) NOT NULL DEFAULT 0,
  wastage_kg numeric(12,3) NOT NULL DEFAULT 0 CHECK (wastage_kg >= 0),
  wastage_percent numeric(7,2) NOT NULL DEFAULT 0,
  start_time time NOT NULL,
  end_time time NOT NULL,
  total_time text NOT NULL DEFAULT '',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS pvc_cutting_lot_number_active_key ON pvc_cutting (lot_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS pvc_cutting_date_idx ON pvc_cutting (date);

CREATE OR REPLACE FUNCTION private.set_pvc_cutting_totals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_minutes integer;
BEGIN
  NEW.out_weight_kg := NEW.total_in_weight_kg - NEW.balance_weight_kg;
  NEW.wastage_percent := CASE WHEN NEW.total_in_weight_kg > 0 THEN round(NEW.wastage_kg / NEW.total_in_weight_kg * 100, 2) ELSE 0 END;
  v_minutes := (EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60)::integer;
  IF v_minutes < 0 THEN
    v_minutes := v_minutes + 1440;
  END IF;
  NEW.total_time := private.format_minutes(v_minutes);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pvc_cutting_set_totals ON pvc_cutting;
CREATE TRIGGER pvc_cutting_set_totals
BEFORE INSERT OR UPDATE ON pvc_cutting
FOR EACH ROW EXECUTE FUNCTION private.set_pvc_cutting_totals();

ALTER TABLE pvc_cutting ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON pvc_cutting FROM anon;
REVOKE DELETE ON pvc_cutting FROM authenticated;
GRANT SELECT ON pvc_cutting TO authenticated;
GRANT INSERT (lot_number, date, operator_name, job_name, description, cutting_size_mm, total_in_weight_kg, balance_weight_kg, wastage_kg, start_time, end_time, created_by)
  ON pvc_cutting TO authenticated;
GRANT UPDATE (lot_number, date, operator_name, job_name, description, cutting_size_mm, total_in_weight_kg, balance_weight_kg, wastage_kg, start_time, end_time)
  ON pvc_cutting TO authenticated;

DROP POLICY IF EXISTS "select_active_pvc_cutting" ON pvc_cutting;
CREATE POLICY "select_active_pvc_cutting" ON pvc_cutting FOR SELECT
TO authenticated
USING (deleted_at IS NULL AND private.is_approved_user());

DROP POLICY IF EXISTS "select_deleted_pvc_cutting_admin" ON pvc_cutting;
CREATE POLICY "select_deleted_pvc_cutting_admin" ON pvc_cutting FOR SELECT
TO authenticated
USING (deleted_at IS NOT NULL AND private.is_approved_user() AND private.is_admin());

DROP POLICY IF EXISTS "insert_pvc_cutting" ON pvc_cutting;
CREATE POLICY "insert_pvc_cutting" ON pvc_cutting FOR INSERT
TO authenticated
WITH CHECK (deleted_at IS NULL AND private.is_approved_user() AND created_by = auth.uid());

DROP POLICY IF EXISTS "update_pvc_cutting_admin" ON pvc_cutting;
CREATE POLICY "update_pvc_cutting_admin" ON pvc_cutting FOR UPDATE
TO authenticated
USING (deleted_at IS NULL AND private.is_approved_user() AND private.is_admin())
WITH CHECK (deleted_at IS NULL AND private.is_approved_user() AND private.is_admin());

CREATE OR REPLACE FUNCTION public.soft_delete_pvc_cutting(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT (private.is_approved_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only administrators can delete PVC cutting entries' USING ERRCODE = '42501';
  END IF;
  UPDATE public.pvc_cutting SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This entry was not found or is already in the Trash';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_pvc_cutting(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT (private.is_approved_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only administrators can restore PVC cutting entries' USING ERRCODE = '42501';
  END IF;
  BEGIN
    UPDATE public.pvc_cutting SET deleted_at = NULL, deleted_by = NULL
    WHERE id = p_id AND deleted_at IS NOT NULL;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Another active entry already uses this lot number. Change that lot number before restoring this entry.';
  END;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This entry is not in the Trash';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_pvc_cutting(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT (private.is_approved_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only administrators can delete PVC cutting entries' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.pvc_cutting WHERE id = p_id AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only items in the Trash can be deleted permanently';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_pvc_cutting(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restore_pvc_cutting(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purge_pvc_cutting(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_pvc_cutting(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_pvc_cutting(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_pvc_cutting(uuid) TO authenticated;
