/*
# User management, suspension and permissions

Plain English: the first administrator can now manage every user from one screen. They can change a
user's role, suspend or restore an operator, and grant or remove two permissions: deleting entries and
viewing reports. Suspended users are locked out of all data. Only the first administrator can make
these changes, and nobody can change their own access.

1. Modified Tables
- `profiles` gains `email`, `is_suspended` (default false), `can_delete_entries` (default true) and
  `can_view_reports` (default true). Existing users keep their current abilities.

2. New Functions
- `private.is_active_user()`: true when the caller exists and is not suspended.
- `private.can_delete_production_entries()`: true when the caller is an active admin, or an active
  operator with the delete permission.
- `public.is_first_admin()`: true when the caller is the earliest-created administrator.
- `public.set_user_access(...)`: the only way to change a user's role, suspension or permissions.
  It checks that the caller is the first administrator and that they are not changing themselves.

3. Security
- Users can no longer update profiles directly; the UPDATE grant and admin update policy are removed.
- Every data policy (profiles, operators, machines, production entries) now requires an active,
  non-suspended caller.
- Deleting a production entry requires being an admin or holding the delete permission.
- Existing policies that let admins manage masters and entries still apply to active admins only.

4. Notes
- Reports visibility is enforced in the app; the report data itself is still readable by active users
  because all entry rows are shared across departments.
- Existing `handle_new_user` behaviour is preserved; it now also stores the sign-up email.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_delete_entries boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_view_reports boolean NOT NULL DEFAULT true;

UPDATE public.profiles AS p
SET email = COALESCE(u.email, '')
FROM auth.users AS u
WHERE u.id = p.id AND p.email = '';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    CASE WHEN EXISTS (SELECT 1 FROM public.profiles) THEN 'operator' ELSE 'admin' END,
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = auth.uid() AND NOT p.is_suspended
  );
$$;

CREATE OR REPLACE FUNCTION private.can_delete_production_entries()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = auth.uid() AND NOT p.is_suspended AND (p.role = 'admin' OR p.can_delete_entries)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_first_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND NOT p.is_suspended
      AND p.id = (
        SELECT f.id FROM public.profiles AS f
        WHERE f.role = 'admin'
        ORDER BY f.created_at, f.id
        LIMIT 1
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION private.is_active_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.can_delete_production_entries() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_delete_production_entries() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_first_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_user_access(
  p_user_id uuid,
  p_role text,
  p_is_suspended boolean,
  p_can_delete_entries boolean,
  p_can_view_reports boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_first_admin() THEN
    RAISE EXCEPTION 'Only the first administrator can manage user access' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own access';
  END IF;
  IF p_role NOT IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  UPDATE public.profiles
  SET role = p_role,
      is_suspended = p_is_suspended,
      can_delete_entries = p_can_delete_entries,
      can_view_reports = p_can_view_reports
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_access(uuid, text, boolean, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_access(uuid, text, boolean, boolean, boolean) TO authenticated;

REVOKE UPDATE ON public.profiles FROM authenticated;
DROP POLICY IF EXISTS "update_profiles_admin" ON public.profiles;

DROP POLICY IF EXISTS "select_own_or_admin_profiles" ON public.profiles;
CREATE POLICY "select_own_or_admin_profiles" ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR (private.is_active_user() AND private.is_admin()));

DROP POLICY IF EXISTS "select_operators" ON public.operators;
CREATE POLICY "select_operators" ON public.operators FOR SELECT
  TO authenticated USING (private.is_active_user());

DROP POLICY IF EXISTS "insert_operators" ON public.operators;
CREATE POLICY "insert_operators" ON public.operators FOR INSERT
  TO authenticated WITH CHECK (private.is_active_user());

DROP POLICY IF EXISTS "update_operators_admin" ON public.operators;
CREATE POLICY "update_operators_admin" ON public.operators FOR UPDATE
  TO authenticated
  USING (private.is_active_user() AND private.is_admin())
  WITH CHECK (private.is_active_user() AND private.is_admin());

DROP POLICY IF EXISTS "delete_operators_admin" ON public.operators;
CREATE POLICY "delete_operators_admin" ON public.operators FOR DELETE
  TO authenticated USING (private.is_active_user() AND private.is_admin());

DROP POLICY IF EXISTS "select_machines" ON public.machines;
CREATE POLICY "select_machines" ON public.machines FOR SELECT
  TO authenticated USING (private.is_active_user());

DROP POLICY IF EXISTS "insert_machines_admin" ON public.machines;
CREATE POLICY "insert_machines_admin" ON public.machines FOR INSERT
  TO authenticated WITH CHECK (private.is_active_user() AND private.is_admin());

DROP POLICY IF EXISTS "update_machines_admin" ON public.machines;
CREATE POLICY "update_machines_admin" ON public.machines FOR UPDATE
  TO authenticated
  USING (private.is_active_user() AND private.is_admin())
  WITH CHECK (private.is_active_user() AND private.is_admin());

DROP POLICY IF EXISTS "delete_machines_admin" ON public.machines;
CREATE POLICY "delete_machines_admin" ON public.machines FOR DELETE
  TO authenticated USING (private.is_active_user() AND private.is_admin());

DROP POLICY IF EXISTS "select_production_entries" ON public.production_entries;
CREATE POLICY "select_production_entries" ON public.production_entries FOR SELECT
  TO authenticated USING (private.is_active_user());

DROP POLICY IF EXISTS "insert_own_production_entries" ON public.production_entries;
CREATE POLICY "insert_own_production_entries" ON public.production_entries FOR INSERT
  TO authenticated WITH CHECK (private.is_active_user() AND created_by = auth.uid());

DROP POLICY IF EXISTS "update_own_or_admin_production_entries" ON public.production_entries;
CREATE POLICY "update_own_or_admin_production_entries" ON public.production_entries FOR UPDATE
  TO authenticated
  USING (private.is_active_user() AND (created_by = auth.uid() OR private.is_admin()))
  WITH CHECK (private.is_active_user() AND (created_by = auth.uid() OR private.is_admin()));

DROP POLICY IF EXISTS "delete_own_or_admin_production_entries" ON public.production_entries;
CREATE POLICY "delete_own_or_admin_production_entries" ON public.production_entries FOR DELETE
  TO authenticated
  USING (private.is_active_user() AND (private.is_admin() OR (created_by = auth.uid() AND private.can_delete_production_entries())));
