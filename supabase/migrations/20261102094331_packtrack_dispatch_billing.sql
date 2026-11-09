/*
# Dispatch and billing module

## Plain-English summary
Adds dispatch notes (DN-0001, DN-0002, ...) for finished goods sent to customers. Each dispatch records the customer, date, PO number, vehicle number, LR/Bilty number, one or more product lines, GST at 18% and a Paid/Unpaid status. Creating a dispatch deducts the dispatched quantity from finished goods stock in the inventory ledger, in the same transaction, so stock can never go negative.

## 1. New tables
- dispatch_master: one row per dispatch. dispatch_no is generated automatically (DN-0001). Holds date, customer name, PO number, vehicle number, LR/Bilty number, subtotal, GST rate (18), GST amount, grand total and payment status (Paid or Unpaid).
- dispatch_items: product lines of a dispatch. Each line links to a finished goods item in the inventory, with size, quantity in Kg, quantity in Pcs, rate and an automatically calculated amount.

## 2. Functions
- dispatch_master_assign_no (trigger): assigns the next DN number on insert. Clients never choose it.
- create_dispatch (RPC): the only way to create a dispatch. It checks the caller is an active user, validates every line, looks up each product's unit and stock on the server, calculates amounts, subtotal, GST and grand total on the server, writes the dispatch and its lines, and records a stock issue for each line. Any failure (for example, not enough stock) rolls back the whole dispatch.

## 3. Security
- Row level security is enabled on both tables.
- Signed-in active users can read dispatches and their lines.
- Signed-in active users can change only the payment status of a dispatch. Customer, quantities, rates and totals cannot be edited after saving.
- Dispatches cannot be deleted from the app, so stock history stays complete.
- Creating a dispatch is only possible through create_dispatch, which is callable by signed-in users only (not anonymous users).

## 4. Notes
- Only items in the Finished Goods category can be dispatched. The billed quantity is the Kg quantity for Kg products and the Pcs quantity for Pcs products; rates are applied per that unit.
- Statements are idempotent so the migration can be safely re-run.
*/

CREATE TABLE IF NOT EXISTS public.dispatch_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_no text NOT NULL DEFAULT '' UNIQUE,
  dispatch_date date NOT NULL DEFAULT current_date,
  customer_name text NOT NULL CHECK (length(btrim(customer_name)) > 0),
  po_number text NOT NULL DEFAULT '',
  vehicle_no text NOT NULL DEFAULT '',
  lr_no text NOT NULL DEFAULT '',
  subtotal numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  gst_rate numeric(5,2) NOT NULL DEFAULT 18 CHECK (gst_rate >= 0),
  gst_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  grand_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  payment_status text NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Paid', 'Unpaid')),
  created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dispatch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL REFERENCES public.dispatch_master(id) ON DELETE CASCADE,
  line_no integer NOT NULL CHECK (line_no > 0),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  size text NOT NULL DEFAULT '',
  qty_kg numeric(14,3) NOT NULL DEFAULT 0 CHECK (qty_kg >= 0),
  qty_pcs numeric(14,3) NOT NULL DEFAULT 0 CHECK (qty_pcs >= 0),
  rate numeric(14,2) NOT NULL CHECK (rate >= 0),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dispatch_id, line_no)
);

CREATE INDEX IF NOT EXISTS dispatch_master_date_idx ON public.dispatch_master (dispatch_date);
CREATE INDEX IF NOT EXISTS dispatch_items_dispatch_idx ON public.dispatch_items (dispatch_id);
CREATE INDEX IF NOT EXISTS dispatch_items_item_idx ON public.dispatch_items (item_id);

CREATE OR REPLACE FUNCTION public.dispatch_master_assign_no()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_no integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('dispatch_no'));
  SELECT COALESCE(MAX(substring(dispatch_no FROM '[0-9]+$')::integer), 0) + 1
    INTO next_no
    FROM public.dispatch_master;
  NEW.dispatch_no := 'DN-' || lpad(next_no::text, 4, '0');
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dispatch_master_assign_no() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS dispatch_master_assign_no ON public.dispatch_master;
CREATE TRIGGER dispatch_master_assign_no
BEFORE INSERT ON public.dispatch_master
FOR EACH ROW EXECUTE FUNCTION public.dispatch_master_assign_no();

CREATE OR REPLACE FUNCTION public.create_dispatch(
  p_dispatch_date date,
  p_customer_name text,
  p_po_number text,
  p_vehicle_no text,
  p_lr_no text,
  p_payment_status text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_dispatch_id uuid;
  v_dispatch_no text;
  v_line jsonb;
  v_line_no integer := 0;
  v_item public.inventory_items%ROWTYPE;
  v_qty_kg numeric;
  v_qty_pcs numeric;
  v_rate numeric;
  v_billed numeric;
  v_amount numeric;
  v_subtotal numeric := 0;
  v_gst_rate numeric := 18;
  v_gst numeric;
BEGIN
  IF NOT private.is_active_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_dispatch_date IS NULL THEN
    RAISE EXCEPTION 'Dispatch date is required';
  END IF;
  IF length(btrim(coalesce(p_customer_name, ''))) = 0 OR length(p_customer_name) > 200 THEN
    RAISE EXCEPTION 'Customer name is required (up to 200 characters)';
  END IF;
  IF p_payment_status NOT IN ('Paid', 'Unpaid') THEN
    RAISE EXCEPTION 'Payment status must be Paid or Unpaid';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Add between 1 and 50 product lines';
  END IF;

  INSERT INTO public.dispatch_master (dispatch_date, customer_name, po_number, vehicle_no, lr_no, gst_rate, payment_status)
  VALUES (
    p_dispatch_date,
    btrim(p_customer_name),
    left(btrim(coalesce(p_po_number, '')), 100),
    left(btrim(coalesce(p_vehicle_no, '')), 50),
    left(btrim(coalesce(p_lr_no, '')), 100),
    v_gst_rate,
    p_payment_status
  )
  RETURNING id, dispatch_no INTO v_dispatch_id, v_dispatch_no;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_line_no := v_line_no + 1;

    SELECT * INTO v_item FROM public.inventory_items WHERE id = (v_line->>'item_id')::uuid FOR UPDATE;
    IF NOT FOUND OR v_item.category <> 'Finished Goods' THEN
      RAISE EXCEPTION 'Line % must be a finished goods product', v_line_no;
    END IF;

    v_qty_kg := COALESCE(NULLIF(v_line->>'qty_kg', ''), '0')::numeric;
    v_qty_pcs := COALESCE(NULLIF(v_line->>'qty_pcs', ''), '0')::numeric;
    v_rate := COALESCE(NULLIF(v_line->>'rate', ''), '0')::numeric;

    IF v_qty_kg < 0 OR v_qty_kg > 1000000 OR v_qty_pcs < 0 OR v_qty_pcs > 1000000 THEN
      RAISE EXCEPTION 'Line % has an invalid quantity', v_line_no;
    END IF;
    IF v_rate < 0 OR v_rate > 10000000 THEN
      RAISE EXCEPTION 'Line % has an invalid rate', v_line_no;
    END IF;

    v_billed := CASE v_item.unit WHEN 'Kg' THEN v_qty_kg WHEN 'Pcs' THEN v_qty_pcs ELSE 0 END;
    IF v_item.unit NOT IN ('Kg', 'Pcs') THEN
      RAISE EXCEPTION 'Line % product is measured in %, which cannot be dispatched', v_line_no, v_item.unit;
    END IF;
    IF v_billed <= 0 THEN
      RAISE EXCEPTION 'Line % needs a quantity in %', v_line_no, v_item.unit;
    END IF;

    v_amount := round(v_billed * v_rate, 2);
    v_subtotal := v_subtotal + v_amount;

    INSERT INTO public.stock_transactions (item_id, txn_type, txn_date, quantity, rate, reason, job_card_no)
    VALUES (v_item.id, 'issue', p_dispatch_date, v_billed, 0, 'Dispatched to customer', v_dispatch_no);

    INSERT INTO public.dispatch_items (dispatch_id, line_no, item_id, size, qty_kg, qty_pcs, rate, amount)
    VALUES (
      v_dispatch_id,
      v_line_no,
      v_item.id,
      left(btrim(coalesce(v_line->>'size', '')), 100),
      v_qty_kg,
      v_qty_pcs,
      v_rate,
      v_amount
    );
  END LOOP;

  v_gst := round(v_subtotal * v_gst_rate / 100, 2);

  UPDATE public.dispatch_master
  SET subtotal = v_subtotal,
      gst_amount = v_gst,
      grand_total = v_subtotal + v_gst
  WHERE id = v_dispatch_id;

  RETURN v_dispatch_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_dispatch(date, text, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_dispatch(date, text, text, text, text, text, jsonb) TO authenticated;

ALTER TABLE public.dispatch_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.dispatch_master, public.dispatch_items TO authenticated;
GRANT UPDATE (payment_status) ON public.dispatch_master TO authenticated;

DROP POLICY IF EXISTS select_dispatch_master ON public.dispatch_master;
CREATE POLICY select_dispatch_master ON public.dispatch_master FOR SELECT
  TO authenticated
  USING (private.is_active_user());

DROP POLICY IF EXISTS update_dispatch_payment ON public.dispatch_master;
CREATE POLICY update_dispatch_payment ON public.dispatch_master FOR UPDATE
  TO authenticated
  USING (private.is_active_user())
  WITH CHECK (private.is_active_user());

DROP POLICY IF EXISTS select_dispatch_items ON public.dispatch_items;
CREATE POLICY select_dispatch_items ON public.dispatch_items FOR SELECT
  TO authenticated
  USING (private.is_active_user());
