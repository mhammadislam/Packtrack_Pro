/*
# Run inventory views with the caller's rights

1. Modified Views
- `inventory_stock_summary` and `inventory_ledger` now run as the signed-in user (security invoker) instead of the view owner.

2. Why
- The security advisor flagged both views as owner-privileged, which bypasses row-level security on the tables they read.
- The underlying tables already have signed-in read policies, so the views return the same rows to signed-in users.

3. Security
- No table, policy, or grant changes.
- Deleted stock items remain hidden by the view filters added earlier.
*/

ALTER VIEW inventory_stock_summary SET (security_invoker = true);
ALTER VIEW inventory_ledger SET (security_invoker = true);
