-- ============================================================================
-- PAYMENT ALLOCATIONS: oldest-debt-first (FIFO) customer tab
-- ============================================================================
-- Before this migration a payment pointed at one sale (payments.sale_id) or at
-- nothing. Neither shape can express "customer hands over 50, which clears
-- invoice 1 in full and part of invoice 2" — the case the shop actually has.
-- Replacing the column with a join table makes allocation many-to-many, so a
-- payment can settle several invoices and an invoice can be settled by several
-- payments, while every sale keeps an accurate payment_status.
--
-- SECURITY DEFINER on the trigger helpers is deliberate. These functions write
-- denormalized columns on sales and customers, and both tables are RLS-guarded
-- to manager-or-above for UPDATE. An employee is allowed to record a payment
-- (payments_insert_any_role), so without DEFINER the balance UPDATE inside the
-- trigger would match zero rows and silently leave the tab wrong.

-- ============================================================================
-- 1. TABLE
-- ============================================================================

CREATE TABLE payment_allocations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  amount          DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(payment_id, sale_id)
);

CREATE INDEX idx_payment_allocations_sale    ON payment_allocations(sale_id);
CREATE INDEX idx_payment_allocations_payment ON payment_allocations(organization_id, payment_id);

COMMENT ON TABLE payment_allocations IS
  'Which payment settled which sale, and for how much. SUM(amount) per payment
   is <= payments.amount; the shortfall is unapplied credit on the account.';
COMMENT ON COLUMN payment_allocations.sale_id IS
  'ON DELETE RESTRICT: sales are soft-deleted, so a hard delete that would
   orphan an allocation is a bug worth blocking loudly.';

-- ============================================================================
-- 2. ROW-LEVEL SECURITY
-- ============================================================================
-- Mirrors sale_items: visibility is org-wide, and write access follows the
-- parent payment's rules (anyone may record, manager+ may alter).

ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_allocations_select_same_org"
ON payment_allocations FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

CREATE POLICY "payment_allocations_insert_any_role"
ON payment_allocations FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_organization_id());

CREATE POLICY "payment_allocations_update_manager_or_above"
ON payment_allocations FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

CREATE POLICY "payment_allocations_delete_manager_or_above"
ON payment_allocations FOR DELETE TO authenticated
USING (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- ============================================================================
-- 3. RECALCULATION HELPERS
-- ============================================================================
-- Plain functions rather than trigger bodies, because four different triggers
-- need the same arithmetic and duplicating it is how the two copies drift.

CREATE OR REPLACE FUNCTION public.fn_recalc_sale_payment(p_sale_id UUID)
RETURNS VOID AS $$
DECLARE
  v_allocated DECIMAL(15,2);
  v_total     DECIMAL(15,2);
  v_status    payment_status;
BEGIN
  IF p_sale_id IS NULL THEN
    RETURN;
  END IF;

  -- Allocations belonging to voided payments do not count.
  SELECT COALESCE(SUM(pa.amount), 0) INTO v_allocated
  FROM payment_allocations pa
  JOIN payments p ON p.id = pa.payment_id
  WHERE pa.sale_id = p_sale_id
    AND p.deleted_at IS NULL;

  SELECT total INTO v_total FROM sales WHERE id = p_sale_id;

  IF v_total IS NULL THEN
    RETURN; -- sale hard-deleted in the same statement
  END IF;

  IF v_allocated <= 0 THEN
    v_status := 'unpaid';
  ELSIF v_allocated >= v_total THEN
    v_status := 'paid';
  ELSE
    v_status := 'partial';
  END IF;

  UPDATE sales
  SET amount_paid    = v_allocated,
      amount_due     = v_total - v_allocated,
      payment_status = v_status,
      updated_at     = NOW()
  WHERE id = p_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.fn_recalc_customer_balance(p_customer_id UUID)
RETURNS VOID AS $$
DECLARE
  v_owed   DECIMAL(15,2);
  v_credit DECIMAL(15,2);
BEGIN
  IF p_customer_id IS NULL THEN
    RETURN;
  END IF;

  -- What is still outstanding across completed invoices. Allocated payments
  -- have already reduced each sale's amount_due via fn_recalc_sale_payment.
  SELECT COALESCE(SUM(amount_due), 0) INTO v_owed
  FROM sales
  WHERE customer_id = p_customer_id
    AND status = 'completed'
    AND deleted_at IS NULL;

  -- Money received but not yet applied to any invoice. Aggregated in a
  -- subquery, not a LEFT JOIN on the outer sum: joining fans each payment out
  -- across its allocations and would multiply payments.amount by that count.
  SELECT COALESCE(SUM(p.amount - COALESCE(a.allocated, 0)), 0) INTO v_credit
  FROM payments p
  LEFT JOIN (
    SELECT payment_id, SUM(amount) AS allocated
    FROM payment_allocations
    GROUP BY payment_id
  ) a ON a.payment_id = p.id
  WHERE p.customer_id = p_customer_id
    AND p.deleted_at IS NULL;

  UPDATE customers
  SET current_balance = v_owed - v_credit
  WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.fn_recalc_customer_balance IS
  'current_balance = outstanding on completed sales - unapplied payment credit.
   Negative means the shop is holding money for the customer.';

-- ============================================================================
-- 4. REPLACE THE SALE-PAYMENT-STATUS TRIGGERS
-- ============================================================================
-- The old ones keyed off payments.sale_id, which is about to disappear.

DROP TRIGGER IF EXISTS trg_update_sale_payment_status_insert ON payments;
DROP TRIGGER IF EXISTS trg_update_sale_payment_status_update ON payments;
DROP TRIGGER IF EXISTS trg_update_sale_payment_status_delete ON payments;
DROP FUNCTION IF EXISTS fn_update_sale_payment_status();

CREATE OR REPLACE FUNCTION public.fn_allocations_recalc_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.fn_recalc_sale_payment(OLD.sale_id);
    PERFORM public.fn_recalc_customer_balance(
      (SELECT customer_id FROM payments WHERE id = OLD.payment_id)
    );
    RETURN OLD;
  END IF;

  -- UPDATE can move an allocation between sales; refresh both sides.
  IF TG_OP = 'UPDATE' AND OLD.sale_id IS DISTINCT FROM NEW.sale_id THEN
    PERFORM public.fn_recalc_sale_payment(OLD.sale_id);
  END IF;

  PERFORM public.fn_recalc_sale_payment(NEW.sale_id);
  PERFORM public.fn_recalc_customer_balance(
    (SELECT customer_id FROM payments WHERE id = NEW.payment_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER trg_allocations_recalc_sale
AFTER INSERT OR UPDATE OR DELETE ON payment_allocations
FOR EACH ROW
EXECUTE FUNCTION public.fn_allocations_recalc_sale();

-- Voiding a payment, or correcting its amount, has to un-pay the invoices it
-- was covering. Without this a soft-deleted payment would leave its sales
-- looking settled.
CREATE OR REPLACE FUNCTION public.fn_payment_changed_recalc_sales()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_id UUID;
  v_sale_id    UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_payment_id := OLD.id;
  ELSE
    v_payment_id := NEW.id;
  END IF;

  FOR v_sale_id IN
    SELECT sale_id FROM payment_allocations WHERE payment_id = v_payment_id
  LOOP
    PERFORM public.fn_recalc_sale_payment(v_sale_id);
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER trg_payment_changed_recalc_sales
AFTER UPDATE OF amount, deleted_at ON payments
FOR EACH ROW
EXECUTE FUNCTION public.fn_payment_changed_recalc_sales();

-- ============================================================================
-- 5. REPLACE THE CUSTOMER-BALANCE TRIGGERS
-- ============================================================================
-- Old formula: SUM(sales.amount_due) - SUM(payments WHERE sale_id IS NULL).
-- New formula lives in fn_recalc_customer_balance and reads allocations.

DROP TRIGGER IF EXISTS trg_update_customer_balance_from_sales_insert ON sales;
DROP TRIGGER IF EXISTS trg_update_customer_balance_from_sales_update ON sales;
DROP TRIGGER IF EXISTS trg_update_customer_balance_from_sales_delete ON sales;
DROP TRIGGER IF EXISTS trg_update_customer_balance_from_payments     ON payments;
DROP FUNCTION IF EXISTS fn_update_customer_balance();

CREATE OR REPLACE FUNCTION public.fn_trg_recalc_customer_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.fn_recalc_customer_balance(OLD.customer_id);
    RETURN OLD;
  END IF;

  -- A sale reassigned to a different customer must clear the old tab too.
  IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
    PERFORM public.fn_recalc_customer_balance(OLD.customer_id);
  END IF;

  PERFORM public.fn_recalc_customer_balance(NEW.customer_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Split per operation because TG_OP is not visible to a WHEN clause.
CREATE TRIGGER trg_customer_balance_from_sales_insert
AFTER INSERT ON sales
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION public.fn_trg_recalc_customer_balance();

CREATE TRIGGER trg_customer_balance_from_sales_update
AFTER UPDATE ON sales
FOR EACH ROW
WHEN (
  OLD.status      IS DISTINCT FROM NEW.status
  OR OLD.amount_due IS DISTINCT FROM NEW.amount_due
  OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
  OR OLD.customer_id IS DISTINCT FROM NEW.customer_id
)
EXECUTE FUNCTION public.fn_trg_recalc_customer_balance();

CREATE TRIGGER trg_customer_balance_from_sales_delete
AFTER DELETE ON sales
FOR EACH ROW
WHEN (OLD.status = 'completed')
EXECUTE FUNCTION public.fn_trg_recalc_customer_balance();

CREATE TRIGGER trg_customer_balance_from_payments
AFTER INSERT OR DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_recalc_customer_balance();

CREATE TRIGGER trg_customer_balance_from_payments_update
AFTER UPDATE OF amount, deleted_at, customer_id ON payments
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_recalc_customer_balance();

-- ============================================================================
-- 6. RPC: record a payment and spread it oldest-debt-first
-- ============================================================================
-- One round trip, one transaction. Doing this from the client would mean read
-- open invoices, then write N allocations — and a second till taking money for
-- the same customer in between would let both payments claim the same invoice.

CREATE OR REPLACE FUNCTION public.record_customer_payment(
  p_organization_id  UUID,
  p_customer_id      UUID,
  p_amount           DECIMAL(15,2),
  p_payment_method   payment_method,
  p_payment_date     DATE DEFAULT CURRENT_DATE,
  p_reference_number TEXT DEFAULT NULL,
  p_notes            TEXT DEFAULT NULL,
  p_sale_id          UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_number     TEXT;
  v_remaining  DECIMAL(15,2);
  v_slice      DECIMAL(15,2);
  v_sale       RECORD;
BEGIN
  IF p_organization_id IS DISTINCT FROM public.current_organization_id() THEN
    RAISE EXCEPTION 'Not authorized for this organization.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.';
  END IF;

  -- Serialize allocation per customer. Two payments landing at once would
  -- otherwise both read the same invoice as unpaid and over-allocate it.
  PERFORM 1 FROM customers
  WHERE id = p_customer_id AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found.';
  END IF;

  v_number := public.generate_payment_number(p_organization_id);

  INSERT INTO payments (
    organization_id, payment_number, customer_id, payment_date,
    amount, payment_method, reference_number, notes, created_by
  ) VALUES (
    p_organization_id, v_number, p_customer_id, p_payment_date,
    p_amount, p_payment_method, p_reference_number, p_notes, auth.uid()
  )
  RETURNING id INTO v_payment_id;

  v_remaining := p_amount;

  -- Upfront payment on a specific sale settles that sale first; only the
  -- change spills onto older debt.
  IF p_sale_id IS NOT NULL THEN
    SELECT id, amount_due INTO v_sale
    FROM sales
    WHERE id = p_sale_id
      AND organization_id = p_organization_id
      AND customer_id = p_customer_id
      AND status = 'completed'
      AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND AND v_sale.amount_due > 0 THEN
      v_slice := LEAST(v_remaining, v_sale.amount_due);
      INSERT INTO payment_allocations (organization_id, payment_id, sale_id, amount)
      VALUES (p_organization_id, v_payment_id, v_sale.id, v_slice);
      v_remaining := v_remaining - v_slice;
    END IF;
  END IF;

  FOR v_sale IN
    SELECT id, amount_due
    FROM sales
    WHERE organization_id = p_organization_id
      AND customer_id = p_customer_id
      AND status = 'completed'
      AND deleted_at IS NULL
      AND amount_due > 0
      AND (p_sale_id IS NULL OR id <> p_sale_id)
    ORDER BY sale_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_slice := LEAST(v_remaining, v_sale.amount_due);
    INSERT INTO payment_allocations (organization_id, payment_id, sale_id, amount)
    VALUES (p_organization_id, v_payment_id, v_sale.id, v_slice);
    v_remaining := v_remaining - v_slice;
  END LOOP;

  -- Whatever is left is intentionally unallocated: credit on the account,
  -- picked up by the next invoice.
  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.record_customer_payment IS
  'Records a payment and applies it oldest-invoice-first. p_sale_id, when given,
   is paid before the FIFO pass. Returns the new payment id.';

-- ============================================================================
-- 7. RPC: create a sale with its line items in one transaction
-- ============================================================================
-- Insert sale, insert items, complete. Split across client calls, a stock
-- failure on completion would leave a stranded draft holding line items.

CREATE OR REPLACE FUNCTION public.create_sale_with_items(
  p_organization_id UUID,
  p_customer_id     UUID,
  p_items           JSONB,
  p_sale_date       DATE DEFAULT CURRENT_DATE,
  p_due_date        DATE DEFAULT NULL,
  p_notes           TEXT DEFAULT NULL,
  p_amount_paid     DECIMAL(15,2) DEFAULT 0,
  p_payment_method  payment_method DEFAULT 'cash'
)
RETURNS UUID AS $$
DECLARE
  v_sale_id  UUID;
  v_item     JSONB;
  v_product  RECORD;
  v_qty      DECIMAL(15,3);
  v_price    DECIMAL(15,2);
  v_discount DECIMAL(15,2);
BEGIN
  IF p_organization_id IS DISTINCT FROM public.current_organization_id() THEN
    RAISE EXCEPTION 'Not authorized for this organization.';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A sale needs at least one line item.';
  END IF;

  INSERT INTO sales (
    organization_id, customer_id, sale_date, due_date, status, notes, created_by
  ) VALUES (
    p_organization_id, p_customer_id, p_sale_date, p_due_date, 'draft', p_notes, auth.uid()
  )
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, name, sku, cost_price INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::UUID
      AND organization_id = p_organization_id
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found in this organization.';
    END IF;

    v_qty      := (v_item->>'quantity')::DECIMAL(15,3);
    v_price    := (v_item->>'unit_price')::DECIMAL(15,2);
    v_discount := COALESCE((v_item->>'discount')::DECIMAL(15,2), 0);

    -- product_name and product_sku are snapshots: renaming a product later
    -- must not rewrite what an old invoice says was sold.
    INSERT INTO sale_items (
      organization_id, sale_id, product_id, product_name, product_sku,
      quantity, unit_price, cost_price, discount, subtotal
    ) VALUES (
      p_organization_id, v_sale_id, v_product.id, v_product.name, v_product.sku,
      v_qty, v_price, v_product.cost_price, v_discount,
      (v_qty * v_price) - v_discount
    );
  END LOOP;

  -- Completing fires the existing triggers: invoice number, totals, stock
  -- deduction. An insufficient-stock RAISE here rolls back the whole sale.
  UPDATE sales SET status = 'completed', updated_at = NOW() WHERE id = v_sale_id;

  IF COALESCE(p_amount_paid, 0) > 0 THEN
    PERFORM public.record_customer_payment(
      p_organization_id, p_customer_id, p_amount_paid, p_payment_method,
      p_sale_date, NULL, NULL, v_sale_id
    );
  END IF;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.create_sale_with_items IS
  'Creates and completes a sale with line items, optionally recording an upfront
   payment against it. p_items: [{product_id, quantity, unit_price, discount}].';

-- ============================================================================
-- 8. BACKFILL, THEN DROP payments.sale_id
-- ============================================================================

INSERT INTO payment_allocations (organization_id, payment_id, sale_id, amount)
SELECT p.organization_id, p.id, p.sale_id, p.amount
FROM payments p
WHERE p.sale_id IS NOT NULL
  AND p.deleted_at IS NULL;

-- idx_payments_sale is dropped with the column it indexes.
ALTER TABLE payments DROP COLUMN sale_id;

-- Bring every cached figure in line with the new formula in one pass, rather
-- than trusting that the backfill's per-row triggers covered every customer.
DO $$
DECLARE
  v_id UUID;
BEGIN
  FOR v_id IN SELECT id FROM sales WHERE deleted_at IS NULL LOOP
    PERFORM public.fn_recalc_sale_payment(v_id);
  END LOOP;

  FOR v_id IN SELECT id FROM customers WHERE deleted_at IS NULL LOOP
    PERFORM public.fn_recalc_customer_balance(v_id);
  END LOOP;
END $$;

COMMENT ON TABLE payments IS
  'Money received from a customer. Not tied to one invoice: see
   payment_allocations for what each payment settled.';
