/*
# PackTrack Pro core database structure

Plain English: creates everything the packaging ERP stores. Staff sign in with email and password.
The first account created becomes the Admin; every later account is a Data Entry Operator.

1. New Tables
- `profiles`: one row per signed-in user, holding full name and role (admin or operator).
- `operators`: master list of operator names used in dropdowns.
- `machines`: master list of machines, grouped by department.
- `production_entries`: every production record for all 9 departments. The `department` column keeps them separate.

2. Security
- Row level security enabled on every table.
- `is_admin()` helper (security definer, not callable by anonymous users) checks the caller's role.
- Profiles: users read their own profile, admins read and change all profiles.
- Operators and machines: any signed-in user reads them and can add operators; only admins change or delete machines and operators.
- Production entries: any signed-in user reads all entries and adds their own; users edit or delete only their own entries, admins can edit or delete any.

3. Notes
- A trigger on sign-up creates the profile row automatically.
- Seed machines are inserted for every department; administrators can rename or extend them in the Machine Master.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS operators_name_unique_idx ON public.operators (lower(name));

CREATE TABLE IF NOT EXISTS public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL CHECK (department IN (
    'printing', 'solventless', 'dry_lamination', 'bag_making', 'pvc_cutting',
    'pvc_center_seal', 'slitting', 'rewinding', 'print_rewinding'
  )),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department, name)
);

CREATE TABLE IF NOT EXISTS public.production_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL CHECK (department IN (
    'printing', 'solventless', 'dry_lamination', 'bag_making', 'pvc_cutting',
    'pvc_center_seal', 'slitting', 'rewinding', 'print_rewinding'
  )),
  entry_date date NOT NULL,
  shift text NOT NULL CHECK (shift IN ('Day', 'Night')),
  operator_name text NOT NULL,
  machine_name text NOT NULL,
  job_ref text NOT NULL DEFAULT '',
  material text NOT NULL DEFAULT '',
  size_spec text NOT NULL DEFAULT '',
  qty_kg numeric(12,3) NOT NULL DEFAULT 0 CHECK (qty_kg >= 0),
  qty_meters numeric(12,2) NOT NULL DEFAULT 0 CHECK (qty_meters >= 0),
  qty_pcs integer NOT NULL DEFAULT 0 CHECK (qty_pcs >= 0),
  wastage_kg numeric(12,3) NOT NULL DEFAULT 0 CHECK (wastage_kg >= 0),
  downtime_reason text NOT NULL DEFAULT 'No Issue' CHECK (downtime_reason IN (
    'No Issue', 'Power Failure', 'Machine Issue', 'Material Issue', 'Other'
  )),
  remarks text NOT NULL DEFAULT '',
  bag_length numeric(10,2),
  bag_width numeric(10,2),
  bag_type text CHECK (bag_type IN ('3 Side Seal', '4 Side Seal')),
  total_pcs integer CHECK (total_pcs >= 0),
  punch_zipper text CHECK (punch_zipper IN ('None', 'Punch', 'Zipper')),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS production_entries_dept_date_idx ON public.production_entries (department, entry_date DESC);
CREATE INDEX IF NOT EXISTS production_entries_date_idx ON public.production_entries (entry_date);
CREATE INDEX IF NOT EXISTS production_entries_operator_idx ON public.production_entries (operator_name);
CREATE INDEX IF NOT EXISTS production_entries_machine_idx ON public.production_entries (department, machine_name);
CREATE INDEX IF NOT EXISTS production_entries_created_by_idx ON public.production_entries (created_by);

CREATE OR REPLACE FUNCTION public.is_admin()
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

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    CASE WHEN EXISTS (SELECT 1 FROM public.profiles) THEN 'operator' ELSE 'admin' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operators TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_entries TO authenticated;

DROP POLICY IF EXISTS "select_own_or_admin_profiles" ON public.profiles;
CREATE POLICY "select_own_or_admin_profiles" ON public.profiles FOR SELECT
  TO authenticated USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "update_profiles_admin" ON public.profiles;
CREATE POLICY "update_profiles_admin" ON public.profiles FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "select_operators" ON public.operators;
CREATE POLICY "select_operators" ON public.operators FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_operators" ON public.operators;
CREATE POLICY "insert_operators" ON public.operators FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_operators_admin" ON public.operators;
CREATE POLICY "update_operators_admin" ON public.operators FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_operators_admin" ON public.operators;
CREATE POLICY "delete_operators_admin" ON public.operators FOR DELETE
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "select_machines" ON public.machines;
CREATE POLICY "select_machines" ON public.machines FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_machines_admin" ON public.machines;
CREATE POLICY "insert_machines_admin" ON public.machines FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_machines_admin" ON public.machines;
CREATE POLICY "update_machines_admin" ON public.machines FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_machines_admin" ON public.machines;
CREATE POLICY "delete_machines_admin" ON public.machines FOR DELETE
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "select_production_entries" ON public.production_entries;
CREATE POLICY "select_production_entries" ON public.production_entries FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_production_entries" ON public.production_entries;
CREATE POLICY "insert_own_production_entries" ON public.production_entries FOR INSERT
  TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "update_own_or_admin_production_entries" ON public.production_entries;
CREATE POLICY "update_own_or_admin_production_entries" ON public.production_entries FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR public.is_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "delete_own_or_admin_production_entries" ON public.production_entries;
CREATE POLICY "delete_own_or_admin_production_entries" ON public.production_entries FOR DELETE
  TO authenticated USING (created_by = auth.uid() OR public.is_admin());

INSERT INTO public.machines (department, name) VALUES
  ('printing', 'Printing M1'),
  ('printing', 'Printing M2'),
  ('printing', 'Printing M3'),
  ('solventless', 'Solventless M1'),
  ('solventless', 'Solventless M2'),
  ('dry_lamination', 'Dry Lamination M1'),
  ('bag_making', 'Bag Making M1'),
  ('bag_making', 'Bag Making M2'),
  ('pvc_cutting', 'PVC Cutting M1'),
  ('pvc_center_seal', 'PVC Center Seal M1'),
  ('slitting', 'Slitting M1'),
  ('rewinding', 'Rewinding M1'),
  ('print_rewinding', 'Print Rewinding M1')
ON CONFLICT (department, name) DO NOTHING;
