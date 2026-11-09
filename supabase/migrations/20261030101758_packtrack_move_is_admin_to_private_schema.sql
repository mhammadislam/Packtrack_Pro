/*
# Move admin check helper out of the public API schema

Plain English: the admin check used by the access rules is moved into a private schema
that the web API cannot call directly. Access rules behave exactly as before.

1. New Objects
- Schema `private` with function `private.is_admin()`.

2. Modified Objects
- Policies on profiles, operators, machines and production_entries now call `private.is_admin()`.

3. Removed Objects
- `public.is_admin()` is dropped (it was only used by the access rules being replaced).

4. Security
- Signed-in users may use the private schema only to run the admin check.
- Anonymous users have no access to the private schema or the function.
*/

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION private.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

DROP POLICY IF EXISTS "select_own_or_admin_profiles" ON public.profiles;
CREATE POLICY "select_own_or_admin_profiles" ON public.profiles FOR SELECT
  TO authenticated USING (id = auth.uid() OR private.is_admin());

DROP POLICY IF EXISTS "update_profiles_admin" ON public.profiles;
CREATE POLICY "update_profiles_admin" ON public.profiles FOR UPDATE
  TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "update_operators_admin" ON public.operators;
CREATE POLICY "update_operators_admin" ON public.operators FOR UPDATE
  TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "delete_operators_admin" ON public.operators;
CREATE POLICY "delete_operators_admin" ON public.operators FOR DELETE
  TO authenticated USING (private.is_admin());

DROP POLICY IF EXISTS "insert_machines_admin" ON public.machines;
CREATE POLICY "insert_machines_admin" ON public.machines FOR INSERT
  TO authenticated WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "update_machines_admin" ON public.machines;
CREATE POLICY "update_machines_admin" ON public.machines FOR UPDATE
  TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "delete_machines_admin" ON public.machines;
CREATE POLICY "delete_machines_admin" ON public.machines FOR DELETE
  TO authenticated USING (private.is_admin());

DROP POLICY IF EXISTS "update_own_or_admin_production_entries" ON public.production_entries;
CREATE POLICY "update_own_or_admin_production_entries" ON public.production_entries FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR private.is_admin())
  WITH CHECK (created_by = auth.uid() OR private.is_admin());

DROP POLICY IF EXISTS "delete_own_or_admin_production_entries" ON public.production_entries;
CREATE POLICY "delete_own_or_admin_production_entries" ON public.production_entries FOR DELETE
  TO authenticated USING (created_by = auth.uid() OR private.is_admin());

DROP FUNCTION IF EXISTS public.is_admin();
