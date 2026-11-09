/*
# Trash: soft delete and restore for all deletable records

1. Summary
- Admin deletes of QC reports, stock items, operators and machines no longer remove the row. They are marked deleted with the time and the user who deleted them.
- Production entries already used this; they now also get a permanent delete option in the Trash.
- Deleted rows disappear from every normal list, dropdown and stock total.
- Admins can see everything in the Trash, restore any item, or delete it permanently.

2. Modified tables
- inventory_items, qc_reports, operators, machines: new columns `deleted_at` (timestamptz, null while active) and `deleted_by` (uuid).
- machines: the unique name per department now applies only to active machines, so a deleted machine's name can be reused. Restoring is blocked if the name is taken again.

3. Security changes
- SELECT for active users returns only active rows. A new admin-only SELECT policy returns deleted rows for the Trash.
- UPDATE policies only apply to active rows and must keep them active, so deletion always goes through the functions below.
- DELETE privilege and DELETE policies are removed from these tables. Rows are never physically removed through the data API.
- New admin-only functions per table: soft delete, restore, and permanent delete (permanent delete only works on rows already in the Trash).
- Permanent delete of a stock item is refused when it still has stock movements or dispatch lines, which keeps the stock history intact.
- A trigger rejects stock movements (including dispatch lines) for deleted stock items, because dispatch runs with elevated rights and would otherwise bypass row rules.

4. Important notes
- Existing rows are unaffected; they stay active.
- Dispatch notes themselves still cannot be deleted.
*/

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE qc_reports ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE qc_reports ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE machines DROP CONSTRAINT IF EXISTS machines_department_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS machines_department_name_active_key
  ON machines (department, name) WHERE deleted_at IS NULL;

-- inventory_items
DROP POLICY IF EXISTS "select_inventory_items" ON inventory_items;
CREATE POLICY "select_inventory_items" ON inventory_items FOR SELECT
  TO authenticated
  USING (private.is_active_user() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "select_deleted_inventory_items_admin" ON inventory_items;
CREATE POLICY "select_deleted_inventory_items_admin" ON inventory_items FOR SELECT
  TO authenticated
  USING (private.is_active_user() AND private.is_admin() AND deleted_at IS NOT NULL);

DROP POLICY IF EXISTS "update_inventory_items" ON inventory_items;
CREATE POLICY "update_inventory_items" ON inventory_items FOR UPDATE
  TO authenticated
  USING (private.is_active_user() AND deleted_at IS NULL)
  WITH CHECK (private.is_active_user() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "delete_inventory_items_admin" ON inventory_items;
REVOKE DELETE ON inventory_items FROM authenticated, anon;

-- qc_reports
DROP POLICY IF EXISTS "select_qc_reports" ON qc_reports;
CREATE POLICY "select_qc_reports" ON qc_reports FOR SELECT
  TO authenticated
  USING (private.is_active_user() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "select_deleted_qc_reports_admin" ON qc_reports;
CREATE POLICY "select_deleted_qc_reports_admin" ON qc_reports FOR SELECT
  TO authenticated
  USING (private.is_active_user() AND private.is_admin() AND deleted_at IS NOT NULL);

DROP POLICY IF EXISTS "update_own_or_admin_qc_reports" ON qc_reports;
CREATE POLICY "update_own_or_admin_qc_reports" ON qc_reports FOR UPDATE
  TO authenticated
  USING (
    private.is_active_user() AND deleted_at IS NULL
    AND (created_by = auth.uid() OR private.is_admin())
  )
  WITH CHECK (
    private.is_active_user() AND deleted_at IS NULL
    AND (created_by = auth.uid() OR private.is_admin())
  );

DROP POLICY IF EXISTS "delete_admin_qc_reports" ON qc_reports;
REVOKE DELETE ON qc_reports FROM authenticated, anon;

-- operators
DROP POLICY IF EXISTS "select_operators" ON operators;
CREATE POLICY "select_operators" ON operators FOR SELECT
  TO authenticated
  USING (private.is_active_user() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "select_deleted_operators_admin" ON operators;
CREATE POLICY "select_deleted_operators_admin" ON operators FOR SELECT
  TO authenticated
  USING (private.is_active_user() AND private.is_admin() AND deleted_at IS NOT NULL);

DROP POLICY IF EXISTS "update_operators_admin" ON operators;
CREATE POLICY "update_operators_admin" ON operators FOR UPDATE
  TO authenticated
  USING (private.is_active_user() AND private.is_admin() AND deleted_at IS NULL)
  WITH CHECK (private.is_active_user() AND private.is_admin() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "delete_operators_admin" ON operators;
REVOKE DELETE ON operators FROM authenticated, anon;

-- machines
DROP POLICY IF EXISTS "select_machines" ON machines;
CREATE POLICY "select_machines" ON machines FOR SELECT
  TO authenticated
  USING (private.is_active_user() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "select_deleted_machines_admin" ON machines;
CREATE POLICY "select_deleted_machines_admin" ON machines FOR SELECT
  TO authenticated
  USING (private.is_active_user() AND private.is_admin() AND deleted_at IS NOT NULL);

DROP POLICY IF EXISTS "update_machines_admin" ON machines;
CREATE POLICY "update_machines_admin" ON machines FOR UPDATE
  TO authenticated
  USING (private.is_active_user() AND private.is_admin() AND deleted_at IS NULL)
  WITH CHECK (private.is_active_user() AND private.is_admin() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "delete_machines_admin" ON machines;
REVOKE DELETE ON machines FROM authenticated, anon;

-- production_entries: permanent delete for the Trash
DROP POLICY IF EXISTS "select_deleted_production_entries_admin" ON production_entries;
CREATE POLICY "select_deleted_production_entries_admin" ON production_entries FOR SELECT
  TO authenticated
  USING (private.is_active_user() AND private.is_admin() AND deleted_at IS NOT NULL);

-- Soft delete, restore and permanent delete functions (admin only except production entry soft delete)
CREATE OR REPLACE FUNCTION public.soft_delete_inventory_item(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.is_active_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only admins can delete stock items';
  END IF;
  UPDATE inventory_items SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stock item not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_inventory_item(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.is_active_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only admins can restore stock items';
  END IF;
  UPDATE inventory_items SET deleted_at = NULL, deleted_by = NULL
  WHERE id = p_id AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deleted stock item not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_inventory_item(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.is_active_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only admins can permanently delete stock items';
  END IF;
  BEGIN
    DELETE FROM inventory_items WHERE id = p_id AND deleted_at IS NOT NULL;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'This stock item has stock or dispatch history and cannot be permanently deleted. Keep it in the Trash instead.';
  END;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deleted stock item not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_qc_report(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.is_active_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only admins can delete QC reports';
  END IF;
  UPDATE qc_reports SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'QC report not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_qc_report(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.is_active_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only admins can restore QC reports';
  END IF;
  UPDATE qc_reports SET deleted_at = NULL, deleted_by = NULL
  WHERE id = p_id AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deleted QC report not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_qc_report(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.is_active_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only admins can permanently delete QC reports';
  END IF;
  DELETE FROM qc_reports WHERE id = p_id AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deleted QC report not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_operator(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.is_active_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only admins can delete operators';
  END IF;
  UPDATE operators SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operator not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_operator(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.is_active_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only admins can restore operators';
  END IF;
  UPDATE operators SET deleted_at = NULL, deleted_by = NULL
  WHERE id = p_id AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deleted operator not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_operator(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.is_active_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only admins can permanently delete operators';
  END IF;
  DELETE FROM operators WHERE id = p_id AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deleted operator not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_machine(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.is_active_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only admins can delete machines';
  END IF;
  UPDATE machines SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Machine not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_machine(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.is_active_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only admins can restore machines';
  END IF;
  BEGIN
    UPDATE machines SET deleted_at = NULL, deleted_by = NULL
    WHERE id = p_id AND deleted_at IS NOT NULL;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'An active machine with this name already exists in its department. Rename or delete it before restoring.';
  END;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deleted machine not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_machine(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.is_active_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only admins can permanently delete machines';
  END IF;
  DELETE FROM machines WHERE id = p_id AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deleted machine not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_production_entry(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.is_active_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only admins can permanently delete entries';
  END IF;
  DELETE FROM production_entries WHERE id = p_id AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deleted entry not found'; END IF;
END;
$$;

-- Stock movements must not touch deleted items, including dispatch lines created by the dispatch function.
CREATE OR REPLACE FUNCTION private.reject_stock_for_deleted_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.inventory_items WHERE id = NEW.item_id AND deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'This stock item has been deleted. Restore it from the Trash before moving stock.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_transactions_reject_deleted_item ON stock_transactions;
CREATE TRIGGER stock_transactions_reject_deleted_item
  BEFORE INSERT ON stock_transactions
  FOR EACH ROW EXECUTE FUNCTION private.reject_stock_for_deleted_item();

-- Grants: only admins/active users through the functions; no direct delete.
REVOKE EXECUTE ON FUNCTION private.reject_stock_for_deleted_item() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'soft_delete_inventory_item(uuid)', 'restore_inventory_item(uuid)', 'purge_inventory_item(uuid)',
    'soft_delete_qc_report(uuid)', 'restore_qc_report(uuid)', 'purge_qc_report(uuid)',
    'soft_delete_operator(uuid)', 'restore_operator(uuid)', 'purge_operator(uuid)',
    'soft_delete_machine(uuid)', 'restore_machine(uuid)', 'purge_machine(uuid)',
    'purge_production_entry(uuid)'
  ]
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END;
$$;
