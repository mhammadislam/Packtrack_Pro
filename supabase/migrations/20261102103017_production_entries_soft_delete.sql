/*
# Soft delete for production entries with admin restore

1. Summary
- Deleting a department entry no longer removes the row. It is marked as deleted with the time and the user who deleted it.
- Deleted entries disappear from every normal list, report, and dashboard total.
- Admins can open a Deleted Records page, see every deleted entry, and restore any of them.

2. Modified table: production_entries
- New column `deleted_at` (timestamptz, null while the entry is active).
- New column `deleted_by` (uuid, the user who deleted the entry).
- New partial index on `deleted_at` for the Deleted Records page.

3. Security changes
- SELECT for active users now returns only entries where `deleted_at` is null.
- New SELECT policy lets admins read deleted entries only.
- UPDATE policy only applies to active entries, and the new row must also stay active, so a direct update cannot hide or restore an entry outside the official functions.
- The DELETE policy and the DELETE privilege are removed. Rows are never physically deleted through the data API.
- New function `soft_delete_production_entry(uuid)`: marks an entry as deleted. Allowed for admins, and for the entry's creator when they have the "can delete entries" permission.
- New function `restore_production_entry(uuid)`: admins only. Clears the deleted markers.
- Both functions are callable by signed-in users only (not anon, not public).

4. Important notes
- Existing rows are untouched; they stay active because `deleted_at` is null by default.
- Dispatch, inventory, QC, operator and machine records are not changed by this migration.
*/

ALTER TABLE production_entries ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE production_entries ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS production_entries_deleted_at_idx
  ON production_entries (deleted_at) WHERE deleted_at IS NOT NULL;

DROP POLICY IF EXISTS "select_production_entries" ON production_entries;
CREATE POLICY "select_production_entries" ON production_entries FOR SELECT
  TO authenticated
  USING (private.is_active_user() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "select_deleted_production_entries_admin" ON production_entries;
CREATE POLICY "select_deleted_production_entries_admin" ON production_entries FOR SELECT
  TO authenticated
  USING (private.is_active_user() AND private.is_admin() AND deleted_at IS NOT NULL);

DROP POLICY IF EXISTS "update_own_or_admin_production_entries" ON production_entries;
CREATE POLICY "update_own_or_admin_production_entries" ON production_entries FOR UPDATE
  TO authenticated
  USING (
    private.is_active_user() AND deleted_at IS NULL
    AND (created_by = auth.uid() OR private.is_admin())
  )
  WITH CHECK (
    private.is_active_user() AND deleted_at IS NULL
    AND (created_by = auth.uid() OR private.is_admin())
  );

DROP POLICY IF EXISTS "delete_own_or_admin_production_entries" ON production_entries;
REVOKE DELETE ON production_entries FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.soft_delete_production_entry(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.is_active_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE production_entries
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = p_id
    AND deleted_at IS NULL
    AND (
      private.is_admin()
      OR (created_by = auth.uid() AND private.can_delete_production_entries())
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entry not found or you do not have permission to delete it';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_production_entry(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (private.is_active_user() AND private.is_admin()) THEN
    RAISE EXCEPTION 'Only admins can restore entries';
  END IF;

  UPDATE production_entries
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = p_id AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deleted entry not found';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_production_entry(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_production_entry(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.restore_production_entry(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_production_entry(uuid) TO authenticated;
