/*
# Run the first-admin check as the caller

Plain English: the check that tells the app whether the signed-in user is the first administrator now
runs with the caller's own permissions instead of elevated ones. It only reads profile rows the caller
can already see, so the answer is unchanged.

1. Modified Functions
- `public.is_first_admin()` switched from SECURITY DEFINER to SECURITY INVOKER.

2. Security
- Execute rights are unchanged: only signed-in users can call it, anonymous users cannot.
- `public.set_user_access(...)` remains SECURITY DEFINER by design, because it must update profiles,
  and it re-checks the caller with this function before making any change.
*/

ALTER FUNCTION public.is_first_admin() SECURITY INVOKER;
