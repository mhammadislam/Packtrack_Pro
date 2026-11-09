/*
# Hide soft-deleted stock items from inventory views

1. Modified Views
- `inventory_stock_summary`: stock items that are in the Trash are excluded from the summary.
- `inventory_ledger`: ledger rows belonging to items in the Trash are excluded.

2. Why
- These views run with the owner's rights, so row-level security on the base tables does not apply to them.
- The deleted-item filter therefore has to live in the view definitions.

3. Security
- No table, policy, or grant changes. Column lists are unchanged, so existing reads keep working.

4. Notes
- Restoring an item makes it and its history visible again.
*/

CREATE OR REPLACE VIEW inventory_stock_summary AS
WITH moves AS (
  SELECT stock_transactions.item_id,
    COALESCE(sum(stock_transactions.quantity) FILTER (WHERE (stock_transactions.txn_type = 'purchase'::text)), (0)::numeric) AS purchase_in,
    COALESCE(sum(stock_transactions.amount) FILTER (WHERE (stock_transactions.txn_type = 'purchase'::text)), (0)::numeric) AS purchase_amount,
    COALESCE(sum(stock_transactions.quantity) FILTER (WHERE (stock_transactions.txn_type = 'issue'::text)), (0)::numeric) AS issue_out,
    COALESCE(sum(stock_transactions.quantity) FILTER (WHERE (stock_transactions.txn_type = 'adjustment_in'::text)), (0)::numeric) AS adjust_in,
    COALESCE(sum(stock_transactions.quantity) FILTER (WHERE (stock_transactions.txn_type = 'adjustment_out'::text)), (0)::numeric) AS adjust_out
  FROM stock_transactions
  GROUP BY stock_transactions.item_id
), levels AS (
  SELECT i.id, i.item_code, i.item_name, i.category, i.material_type, i.supplier, i.unit,
    i.opening_stock, i.opening_rate, i.minimum_stock, i.reorder_level,
    COALESCE(m.purchase_in, (0)::numeric) AS purchase_in,
    COALESCE(m.purchase_amount, (0)::numeric) AS purchase_amount,
    COALESCE(m.issue_out, (0)::numeric) AS issue_out,
    COALESCE(m.adjust_in, (0)::numeric) AS adjust_in,
    COALESCE(m.adjust_out, (0)::numeric) AS adjust_out
  FROM inventory_items i
    LEFT JOIN moves m ON m.item_id = i.id
  WHERE i.deleted_at IS NULL
), rated AS (
  SELECT l.id, l.item_code, l.item_name, l.category, l.material_type, l.supplier, l.unit,
    l.opening_stock, l.opening_rate, l.minimum_stock, l.reorder_level,
    l.purchase_in, l.purchase_amount, l.issue_out, l.adjust_in, l.adjust_out,
    ((((l.opening_stock + l.purchase_in) + l.adjust_in) - l.issue_out) - l.adjust_out) AS current_stock,
    CASE
      WHEN (l.opening_stock + l.purchase_in) > (0)::numeric THEN round((((l.opening_stock * l.opening_rate) + l.purchase_amount) / (l.opening_stock + l.purchase_in)), 2)
      ELSE (0)::numeric
    END AS avg_rate
  FROM levels l
)
SELECT id, item_code, item_name, category, material_type, supplier, unit,
  opening_stock, minimum_stock, reorder_level,
  purchase_in, issue_out, adjust_in, adjust_out,
  current_stock, avg_rate,
  round((current_stock * avg_rate), 2) AS stock_value
FROM rated;

CREATE OR REPLACE VIEW inventory_ledger AS
SELECT t.id, t.item_id, i.item_code, i.item_name, i.category, i.unit, t.txn_type, t.txn_date,
  CASE
    WHEN (t.txn_type = ANY (ARRAY['purchase'::text, 'adjustment_in'::text])) THEN t.quantity
    ELSE (0)::numeric
  END AS qty_in,
  CASE
    WHEN (t.txn_type = ANY (ARRAY['issue'::text, 'adjustment_out'::text])) THEN t.quantity
    ELSE (0)::numeric
  END AS qty_out,
  (i.opening_stock + sum(
    CASE
      WHEN (t.txn_type = ANY (ARRAY['purchase'::text, 'adjustment_in'::text])) THEN t.quantity
      ELSE (- t.quantity)
    END) OVER (PARTITION BY t.item_id ORDER BY t.txn_date, t.created_at, t.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) AS running_balance,
  t.rate, t.amount, t.supplier_name, t.grn_no, t.supplier_invoice_no, t.department, t.job_card_no, t.reason, t.created_at
FROM stock_transactions t
  JOIN inventory_items i ON i.id = t.item_id
WHERE i.deleted_at IS NULL;
