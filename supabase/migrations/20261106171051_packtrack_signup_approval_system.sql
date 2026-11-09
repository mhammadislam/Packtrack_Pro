/*
# Sign-up with admin approval

1. Plain-English summary
- New accounts are created as "pending approval" and cannot use the app until the Super Administrator approves them.
- Sign-up collects a username and phone number, and every sign-up attempt is written to an audit log.
- The Super Administrator can approve or reject pending requests. Rejections store a reason that the user sees when they try to sign in.

2. Modified table: profiles
- `username` (text, nullable): unique ignoring letter case. Existing users keep an empty username.
- `phone` (text, nullable): Pakistani mobile number, format 03xx-xxxxxxx.
- `status` (text, default 'active'): one of 'pending_approval', 'active', 'rejected'. Existing users are set to 'active'.

3. New table: approval_requests
- One row per sign-up that needs approval: username, email, phone, requested_at, status, approved_by, approved_at, rejected_by, rejected_at, rejection_reason.
- Users can read their own request (to see a rejection reason). Admins can read all requests. Nobody writes to it directly; only the sign-up trigger and the approve/reject functions do.

4. New table: signup_audit_log
- One row per sign-up attempt: username, email, phone, outcome, detail, attempted_at.
- Only administrators can read it. Rows are written by the log function.

5. Functions
- handle_new_user (updated): the first account stays an active administrator. Every later account is pending and gets an approval request.
- is_username_available(username): tells the sign-up form whether a username is free. Returns only true or false.
- log_signup_attempt(...): records an attempt in the audit log.
- approve_signup(user id): Super Administrator only. Activates the account.
- reject_signup(user id, reason): Super Administrator only. Rejects the account with a reason.

6. Security
- Row level security is enabled on the new tables.
- Anonymous and signed-in users have no direct write access to the new tables.
- The approve and reject functions are restricted to the Super Administrator.
- Functions that anonymous visitors need (username check, audit logging) are granted only where required.

7. Important notes
- Existing data is not removed or changed except for the new columns above.
- The first administrator created on an empty database is still made active automatically.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_status_check' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_status_check CHECK (status IN ('pending_approval', 'active', 'rejected'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  username text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  rejection_reason text
);

CREATE INDEX IF NOT EXISTS approval_requests_status_requested_idx
  ON public.approval_requests (status, requested_at);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.approval_requests FROM anon, authenticated;
GRANT SELECT ON public.approval_requests TO authenticated;

DROP POLICY IF EXISTS "select_own_or_admin_approval_requests" ON public.approval_requests;
CREATE POLICY "select_own_or_admin_approval_requests" ON public.approval_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR (private.is_active_user() AND private.is_admin()));

CREATE TABLE IF NOT EXISTS public.signup_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  username text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  outcome text NOT NULL,
  detail text NOT NULL DEFAULT ''
);

ALTER TABLE public.signup_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.signup_audit_log FROM anon, authenticated;
GRANT SELECT ON public.signup_audit_log TO authenticated;

DROP POLICY IF EXISTS "select_admin_signup_audit_log" ON public.signup_audit_log;
CREATE POLICY "select_admin_signup_audit_log" ON public.signup_audit_log FOR SELECT
  TO authenticated
  USING (private.is_active_user() AND private.is_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_is_first boolean := NOT EXISTS (SELECT 1 FROM public.profiles);
  v_status text := CASE WHEN NOT EXISTS (SELECT 1 FROM public.profiles) THEN 'active' ELSE 'pending_approval' END;
  v_username text := NULLIF(btrim(NEW.raw_user_meta_data->>'username'), '');
  v_phone text := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'phone'), ''), '');
  v_email text := COALESCE(NEW.email, '');
BEGIN
  INSERT INTO public.profiles (id, full_name, role, email, username, phone, status)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(v_email, '@', 1)),
    CASE WHEN v_is_first THEN 'admin' ELSE 'operator' END,
    v_email,
    v_username,
    NULLIF(v_phone, ''),
    v_status
  )
  ON CONFLICT (id) DO NOTHING;

  IF v_status = 'pending_approval' THEN
    INSERT INTO public.approval_requests (user_id, username, email, phone, requested_at)
    VALUES (NEW.id, COALESCE(v_username, ''), v_email, v_phone, now())
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(username) = lower(btrim(p_username))
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.is_username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_signup_attempt(
  p_username text,
  p_email text,
  p_phone text,
  p_outcome text,
  p_detail text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF p_outcome NOT IN ('pending_approval', 'active', 'duplicate_email', 'username_taken', 'error') THEN
    RAISE EXCEPTION 'Invalid outcome';
  END IF;

  INSERT INTO public.signup_audit_log (username, email, phone, outcome, detail)
  VALUES (
    left(COALESCE(p_username, ''), 64),
    left(COALESCE(p_email, ''), 254),
    left(COALESCE(p_phone, ''), 32),
    p_outcome,
    left(COALESCE(p_detail, ''), 500)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.log_signup_attempt(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_signup_attempt(text, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.approve_signup(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.is_first_admin() THEN
    RAISE EXCEPTION 'Only the first administrator can approve sign-ups' USING ERRCODE = '42501';
  END IF;

  UPDATE public.approval_requests
  SET status = 'approved', approved_by = auth.uid(), approved_at = now()
  WHERE user_id = p_user_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending request was found for this user';
  END IF;

  UPDATE public.profiles SET status = 'active' WHERE id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_signup(p_user_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF NOT public.is_first_admin() THEN
    RAISE EXCEPTION 'Only the first administrator can reject sign-ups' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_reason) < 3 OR char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'Please give a reason between 3 and 500 characters';
  END IF;

  UPDATE public.approval_requests
  SET status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), rejection_reason = v_reason
  WHERE user_id = p_user_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending request was found for this user';
  END IF;

  UPDATE public.profiles SET status = 'rejected' WHERE id = p_user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.approve_signup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_signup(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_signup(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_signup(uuid, text) TO authenticated;
