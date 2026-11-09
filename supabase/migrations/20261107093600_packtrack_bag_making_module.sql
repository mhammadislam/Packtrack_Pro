/*
# Bag Making department module

1. New Table
- `bag_making`: one row per bag-making run for a lot.
  - Date, lot number (must match an active PVC Cutting lot), job name, PCS.
  - Trim (kg), wastage (kg), in weight (kg).
  - Bag type (3 Side / 4 Side), punch (Yes / No), zipper (Yes / No) and zipper type.
  - Shift (Day Shift / Night Shift), operator name, start and end time.
- Calculated by the database on every save:
  - Out weight = in weight minus wastage minus trim.
  - Wastage percent = wastage / in weight * 100.
  - Total time = end time minus start time, handling shifts that run past midnight.
- Soft delete columns `deleted_at` and `deleted_by`. Deleted entries move to the Trash.

2. Validation
- A new entry, or a changed lot number, must reference an active PVC Cutting lot.

3. Security
- Row-level security enabled on `bag_making`.
- Approved and active users can view active entries and add new ones.
- Only administrators can edit entries.
- Direct deletes are revoked. Administrators delete through `soft_delete_bag_making`, restore through `restore_bag_making`, and remove permanently through `purge_bag_making`.
- Administrators can see deleted entries so they can be restored from the Trash.
- Column-level grants restrict writes to the form fields. Calculated columns and deletion fields are never client-writable.
*/

CREATE TABLE IF NOT EXISTS bag_making (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  lot_number text NOT NULL CHECK (char_length(btrim(lot_number)) > 0),
  job_name text NOT NULL CHECK (char_length(btrim(job_name)) > 0),
  pcs integer NOT NULL CHECK (pcs > 0),
  trim_kg numeric(12,3) NOT NULL DEFAULT 0 CHECK (trim_kg >= 0),
  wastage_kg numeric(12,3) NOT NULL DEFAULT 0 CHECK (wastage_kg >= 0),
  in_weight_kg numeric(12,3) NOT NULL CHECK (in_weight_kg > 0),
  out_weight_kg numeric(12,3) NOT NULL DEFAULT 0,
  wastage_percent numeric(7,2) NOT NULL DEFAULT 0,
  bag_type text CHECK (bag_type IN ('3 Side', '4 Side')),
  punch text CHECK (punch IN ('Yes', 'No')),
  zipper text CHECK (zipper IN ('Yes', 'No')),
  zipper_type text,
  shift text NOT NULL CHECK (shift IN ('Day Shift', 'Night Shift')),
  operator_name text NOT NULL CHECK (char_length(btrim(operator_name)) > 0),
  start_time time NOT NULL,
  end_time time NOT NULL,
  total_time text NOT NULL DEFAULT '',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid,
  CONSTRAINT bag_making_trim_and_wastage_within_in_weight CHECK (trim_kg + wastage_kg <= in_weight_kg)
);

CREATE INDEX IF NOT EXISTS bag_making_date_idx ON bag_making (date);
CREATE INDEX IF NOT EXISTS bag_making_lot_number_idx ON bag_making (lot_number);

CREATE OR REPLACE FUNCTION private.set_bag_making_totals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_minutes integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.pvc_cutting WHERE lot_number = NEW.lot_number AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Select a lot number that exists in PVC Cutting';
    END IF;
  ELSIF NEW.lot_number IS DISTINCT FROM OLD.lot_number THEN
    IF NOT EXISTS (SELECT 1 FROM public.pvc_cutting WHERE lot_number = NEW.lot_number AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Select a lot number that exists in PVC Cutting';
    END IF;
  END IF;

  NEW.out_weight_kg := NEW.in_weight_kg - NEW.wastage_kg - NEW.trim_kg;
  NEW.wastage_percent := CASE WHEN NEW.in_weight_kg > 0 THEN round(NEW.wastage_kg / NEW.in_weight_kg * 100, 2) ELSE 0 END;
  v_minutes := (EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60)::integer;
  IF v_minutes < 0 THEN
    v_minutes := v_minutes + 1440;
  END IF;
  NEW.total_time := private.format_minutes(v_minutes);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bag_making_set_totals ON bag_making;
CREATE TRIGGER bag_making_set_totals
BEFORE INSERT OR UPDATE ON bag_making
FOR EACH ROW EXECUTE FUNCTION private.set_bag_making_totals();

ALTER TABLE bag_making ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON bag_making FROM anon;
REVOKE DELETE ON bag_making FROM authenticated;
GRANT SELECT ON bag_making TO authenticated;
GRANT INSERT (date, lot_number, job_name, pcs, trim_kg, wastage_kg, in_weight_kg, bag_type, punch, zipper, zipper_type, shift, operator_name, start_time, end_time, created_by)
  ON bag_making TO authenticated;
GRANT UPDATE (date, lot_number, job_name, pcs, trim_kg, wastage_kg, in_weight_kg, bag_type, punch, zipper, zipper_type, shift, operator_name, start_time, end_time)
  ON bag_making TO authenticated;

DROP POLICY IF EXISTS "select_active_bag_making" ON bag_making;
CREATE POLICY "select_active_bag_making" ON bag_making FOR SELECT
TO authenticated
USING (deleted_at IS NULL AND private.is_approved_user());

DROP POLICY IF EXISTS "select_deleted_bag_making_admin" ON bag_making;
CREATE POLICY "select_deleted_bag_making_admin" ON bag_making FOR SELECT
TO authenticated
USING (deleted_at IS NOT NULL AND private.is_approved_user() AND private.is_admin());

DROP POLICY IF EXISTS "insert_bag_making" ON bag_making;
CREATE POLICY "insert_bag_making" ON bag_making FOR INSERT
TO authenticated
WITH CHECK (deleted_at IS NULL AND private.is_approved_user() AND created_by = auth.uid());

DROP POLICY IF EXISTS "update_bag_making_admin" ON bag_making;
CREATE POLICY "update_bag_making_admin" ON bag_making FOR UPDATE
TO authenticated
USING (deleted_at IS NULL AND private.is_approved_user() AND private.is_admin())
WITH CHECK (deleted_at IS NULL AND private.is_approved_user() AND private.is_admin());

CREATE OR REPLACE FUNCTION public.soft_delete_bag_making(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT (private.is_approved_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only administrators can delete bag making entries' USING ERRCODE = '42501';
  END IF;
  UPDATE public.bag_making SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This entry was not found or is already in the Trash';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_bag_making(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT (private.is_approved_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only administrators can restore bag making entries' USING ERRCODE = '42501';
  END IF;
  UPDATE public.bag_making SET deleted_at = NULL, deleted_by = NULL
  WHERE id = p_id AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This entry is not in the Trash';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_bag_making(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT (private.is_approved_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only administrators can delete bag making entries' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.bag_making WHERE id = p_id AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only items in the Trash can be deleted permanently';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_bag_making(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restore_bag_making(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purge_bag_making(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_bag_making(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_bag_making(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_bag_making(uuid) TO authenticated;
