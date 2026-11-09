/*
# Inventory and stock module

## Plain-English summary
Adds a stock register for the factory store. Each item (raw material, work-in-progress or finished goods) has an auto-generated code. Every purchase, issue to a department and stock adjustment is recorded as a transaction. Current stock, stock value and the running ledger are calculated automatically from those transactions.

## 1. New tables
- inventory_items: item master. Item code is generated automatically (RM-0001, WIP-0001, FG-0001). Holds category, raw material type, supplier, unit (Kg / Ltr / Pcs), opening stock and opening rate, minimum stock and reorder level.
- stock_transactions: every stock movement. txn_type is purchase, issue, adjustment_in or adjustment_out. Purchases carry date, GRN number, supplier invoice number, quantity and rate; the amount is calculated as quantity x rate. Issues carry the department and job card number.

## 2. New views (read-only, calculated)
- inventory_stock_summary: one row per item with purchases, issues, adjustments, current stock (opening + in - out), weighted average rate and stock value.
- inventory_ledger: every transaction with in/out quantities and a running balance per item.
Both views run with the caller's permissions, so row level security on the tables still applies.

## 3. Automatic behaviour
- Item codes are assigned by a trigger on insert; clients never choose them.
- Issues and stock-out adjustments are rejected by the database when they would take stock below zero.

## 4. Security
- Row level security is enabled on both tables.
- Any active signed-in user can read and record stock movements and manage items.
- Only administrators can delete items. Stock transactions cannot be edited or deleted; corrections are made with a stock adjustment so the history stays complete.
- No access is granted to anonymous users.

## 5. Notes
- Statements are idempotent so the migration can be safely re-run.
*/

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code text NOT NULL DEFAULT '' UNIQUE,
  item_name text NOT NULL CHECK (length(btrim(item_name)) > 0),
  category text NOT NULL CHECK (category IN ('Raw Material', 'WIP', 'Finished Goods')),
  material_type text CHECK (material_type IN ('BOPP', 'PET', 'CPP', 'Ink', 'Solvent', 'Adhesive', 'Zipper')),
  supplier text NOT NULL DEFAULT '',
  unit text NOT NULL CHECK (unit IN ('Kg', 'Ltr', 'Pcs')),
  opening_stock numeric(14,3) NOT NULL DEFAULT 0 CHECK (opening_stock >= 0),
  opening_rate numeric(14,2) NOT NULL DEFAULT 0 CHECK (opening_rate >= 0),
  minimum_stock numeric(14,3) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  reorder_level numeric(14,3) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_items_material_type_rule CHECK ((category = 'Raw Material') = (material_type IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.stock_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  txn_type text NOT NULL CHECK (txn_type IN ('purchase', 'issue', 'adjustment_in', 'adjustment_out')),
  txn_date date NOT NULL DEFAULT current_date,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  rate numeric(14,2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  amount numeric(14,2) GENERATED ALWAYS AS (round(quantity * rate, 2)) STORED,
  supplier_name text NOT NULL DEFAULT '',
  grn_no text NOT NULL DEFAULT '',
  supplier_invoice_no text NOT NULL DEFAULT '',
  department text CHECK (department IN ('Printing', 'Lamination', 'Slitting', 'Bag Making')),
  job_card_no text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_transactions_item_date_idx ON public.stock_transactions (item_id, txn_date);
CREATE INDEX IF NOT EXISTS stock_transactions_date_idx ON public.stock_transactions (txn_date);

CREATE OR REPLACE FUNCTION public.inventory_items_assign_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  prefix text;
  next_no integer;
BEGIN
  prefix := CASE NEW.category WHEN 'Raw Material' THEN 'RM' WHEN 'WIP' THEN 'WIP' ELSE 'FG' END;
  PERFORM pg_advisory_xact_lock(hashtext('inventory_code_' || prefix));
  SELECT COALESCE(MAX(substring(item_code FROM '[0-9]+$')::integer), 0) + 1
    INTO next_no
    FROM public.inventory_items
    WHERE item_code LIKE prefix || '-%';
  NEW.item_code := prefix || '-' || lpad(next_no::text, 4, '0');
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.inventory_items_assign_code() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS inventory_items_assign_code ON public.inventory_items;
CREATE TRIGGER inventory_items_assign_code
BEFORE INSERT ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.inventory_items_assign_code();

CREATE OR REPLACE FUNCTION public.stock_transactions_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  available numeric;
BEGIN
  PERFORM 1 FROM public.inventory_items WHERE id = NEW.item_id FOR UPDATE;
  IF NEW.txn_type IN ('issue', 'adjustment_out') THEN
    available := (SELECT opening_stock FROM public.inventory_items WHERE id = NEW.item_id)
      + (SELECT COALESCE(SUM(CASE WHEN txn_type IN ('purchase', 'adjustment_in') THEN quantity ELSE -quantity END), 0)
           FROM public.stock_transactions WHERE item_id = NEW.item_id);
    IF NEW.quantity > available THEN
      RAISE EXCEPTION 'Only % units are in stock for this item.', available USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.stock_transactions_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS stock_transactions_guard ON public.stock_transactions;
CREATE TRIGGER stock_transactions_guard
BEFORE INSERT ON public.stock_transactions
FOR EACH ROW EXECUTE FUNCTION public.stock_transactions_guard();

CREATE OR REPLACE VIEW public.inventory_stock_summary WITH (security_invoker = true) AS
WITH moves AS (
  SELECT
    item_id,
    COALESCE(SUM(quantity) FILTER (WHERE txn_type = 'purchase'), 0) AS purchase_in,
    COALESCE(SUM(amount) FILTER (WHERE txn_type = 'purchase'), 0) AS purchase_amount,
    COALESCE(SUM(quantity) FILTER (WHERE txn_type = 'issue'), 0) AS issue_out,
    COALESCE(SUM(quantity) FILTER (WHERE txn_type = 'adjustment_in'), 0) AS adjust_in,
    COALESCE(SUM(quantity) FILTER (WHERE txn_type = 'adjustment_out'), 0) AS adjust_out
  FROM public.stock_transactions
  GROUP BY item_id
),
levels AS (
  SELECT
    i.id, i.item_code, i.item_name, i.category, i.material_type, i.supplier, i.unit,
    i.opening_stock, i.opening_rate, i.minimum_stock, i.reorder_level,
    COALESCE(m.purchase_in, 0) AS purchase_in,
    COALESCE(m.purchase_amount, 0) AS purchase_amount,
    COALESCE(m.issue_out, 0) AS issue_out,
    COALESCE(m.adjust_in, 0) AS adjust_in,
    COALESCE(m.adjust_out, 0) AS adjust_out
  FROM public.inventory_items i
  LEFT JOIN moves m ON m.item_id = i.id
),
rated AS (
  SELECT
    l.*,
    l.opening_stock + l.purchase_in + l.adjust_in - l.issue_out - l.adjust_out AS current_stock,
    CASE
      WHEN l.opening_stock + l.purchase_in > 0
        THEN ROUND((l.opening_stock * l.opening_rate + l.purchase_amount) / (l.opening_stock + l.purchase_in), 2)
      ELSE 0
    END AS avg_rate
  FROM levels l
)
SELECT
  id, item_code, item_name, category, material_type, supplier, unit,
  opening_stock, minimum_stock, reorder_level,
  purchase_in, issue_out, adjust_in, adjust_out,
  current_stock, avg_rate,
  ROUND(current_stock * avg_rate, 2) AS stock_value
FROM rated;

CREATE OR REPLACE VIEW public.inventory_ledger WITH (security_invoker = true) AS
SELECT
  t.id,
  t.item_id,
  i.item_code,
  i.item_name,
  i.category,
  i.unit,
  t.txn_type,
  t.txn_date,
  CASE WHEN t.txn_type IN ('purchase', 'adjustment_in') THEN t.quantity ELSE 0 END AS qty_in,
  CASE WHEN t.txn_type IN ('issue', 'adjustment_out') THEN t.quantity ELSE 0 END AS qty_out,
  i.opening_stock + SUM(CASE WHEN t.txn_type IN ('purchase', 'adjustment_in') THEN t.quantity ELSE -t.quantity END)
    OVER (PARTITION BY t.item_id ORDER BY t.txn_date, t.created_at, t.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance,
  t.rate,
  t.amount,
  t.supplier_name,
  t.grn_no,
  t.supplier_invoice_no,
  t.department,
  t.job_card_no,
  t.reason,
  t.created_at
FROM public.stock_transactions t
JOIN public.inventory_items i ON i.id = t.item_id;

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT SELECT, INSERT ON public.stock_transactions TO authenticated;
GRANT SELECT ON public.inventory_stock_summary, public.inventory_ledger TO authenticated;

DROP POLICY IF EXISTS select_inventory_items ON public.inventory_items;
CREATE POLICY select_inventory_items ON public.inventory_items FOR SELECT
  TO authenticated USING (private.is_active_user());

DROP POLICY IF EXISTS insert_inventory_items ON public.inventory_items;
CREATE POLICY insert_inventory_items ON public.inventory_items FOR INSERT
  TO authenticated WITH CHECK (private.is_active_user() AND created_by = auth.uid());

DROP POLICY IF EXISTS update_inventory_items ON public.inventory_items;
CREATE POLICY update_inventory_items ON public.inventory_items FOR UPDATE
  TO authenticated USING (private.is_active_user()) WITH CHECK (private.is_active_user());

DROP POLICY IF EXISTS delete_inventory_items_admin ON public.inventory_items;
CREATE POLICY delete_inventory_items_admin ON public.inventory_items FOR DELETE
  TO authenticated USING (private.is_active_user() AND private.is_admin());

DROP POLICY IF EXISTS select_stock_transactions ON public.stock_transactions;
CREATE POLICY select_stock_transactions ON public.stock_transactions FOR SELECT
  TO authenticated USING (private.is_active_user());

DROP POLICY IF EXISTS insert_stock_transactions ON public.stock_transactions;
CREATE POLICY insert_stock_transactions ON public.stock_transactions FOR INSERT
  TO authenticated WITH CHECK (private.is_active_user() AND created_by = auth.uid());
