-- ============================================================================
-- SALES WORKFLOW TRIGGERS
-- ============================================================================
-- Handles automatic updates to:
--   1. Sale totals when items are added/removed/updated
--   2. Sale payment status when payments are recorded
--   3. Customer balance when sales are completed/cancelled or payments recorded
--
-- These triggers replace/improve the partial implementations from migration 003.
-- ============================================================================

-- Drop old triggers from migration 003 (if they exist)
DROP TRIGGER IF EXISTS trigger_update_sale_totals ON sale_items;
DROP TRIGGER IF EXISTS trigger_update_customer_balance ON sales;
DROP TRIGGER IF EXISTS trigger_update_sale_from_payment ON payments;

DROP FUNCTION IF EXISTS update_sale_totals();
DROP FUNCTION IF EXISTS update_customer_balance_from_sale();
DROP FUNCTION IF EXISTS update_sale_from_payment();

-- ============================================================================
-- TRIGGER 1: Recalculate sale totals when items change
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_recalculate_sale_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_id UUID;
  v_new_subtotal DECIMAL(15,2);
BEGIN
  -- Determine which sale to update
  v_sale_id := COALESCE(NEW.sale_id, OLD.sale_id);

  -- Calculate new subtotal from all items
  SELECT COALESCE(SUM(subtotal), 0) INTO v_new_subtotal
  FROM sale_items
  WHERE sale_id = v_sale_id;

  -- Update sale totals
  UPDATE sales
  SET
    subtotal = v_new_subtotal,
    total = v_new_subtotal + tax - discount,
    amount_due = (v_new_subtotal + tax - discount) - amount_paid,
    updated_at = NOW()
  WHERE id = v_sale_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalculate_sale_totals
AFTER INSERT OR UPDATE OR DELETE ON sale_items
FOR EACH ROW
EXECUTE FUNCTION fn_recalculate_sale_totals();

COMMENT ON FUNCTION fn_recalculate_sale_totals IS
  'Recalculates sale subtotal, total, and amount_due whenever items are added, removed, or updated.
   Ensures sale totals are always consistent with line items.';

-- ============================================================================
-- TRIGGER 2: Update sale payment status when payments change
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_update_sale_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_id UUID;
  v_total_paid DECIMAL(15,2);
  v_sale_total DECIMAL(15,2);
  v_new_payment_status payment_status;
BEGIN
  -- Determine which sale to update
  v_sale_id := COALESCE(NEW.sale_id, OLD.sale_id);

  -- Skip if payment is not linked to a sale (unallocated payment)
  IF v_sale_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate total amount paid for this sale
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM payments
  WHERE sale_id = v_sale_id
    AND deleted_at IS NULL;

  -- Get sale total
  SELECT total INTO v_sale_total
  FROM sales
  WHERE id = v_sale_id;

  -- Derive payment status
  IF v_total_paid = 0 THEN
    v_new_payment_status := 'unpaid';
  ELSIF v_total_paid >= v_sale_total THEN
    v_new_payment_status := 'paid';
  ELSE
    v_new_payment_status := 'partial';
  END IF;

  -- Update sale
  UPDATE sales
  SET
    amount_paid = v_total_paid,
    amount_due = v_sale_total - v_total_paid,
    payment_status = v_new_payment_status,
    updated_at = NOW()
  WHERE id = v_sale_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_sale_payment_status_insert
AFTER INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION fn_update_sale_payment_status();

CREATE TRIGGER trg_update_sale_payment_status_delete
AFTER DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION fn_update_sale_payment_status();

COMMENT ON FUNCTION fn_update_sale_payment_status IS
  'Automatically updates sale.amount_paid, amount_due, and payment_status
   whenever a payment is recorded or deleted. Payment status is derived:
   - unpaid: amount_paid = 0
   - partial: 0 < amount_paid < total
   - paid: amount_paid >= total';

-- ============================================================================
-- TRIGGER 3: Update customer balance when sales/payments change
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_update_customer_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id UUID;
  v_new_balance DECIMAL(15,2);
BEGIN
  -- Determine which customer to update
  IF TG_TABLE_NAME = 'sales' THEN
    v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
  ELSIF TG_TABLE_NAME = 'payments' THEN
    v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
  END IF;

  -- Recalculate customer balance from scratch
  -- Balance = SUM(completed sales amount_due) - SUM(unallocated payments)
  SELECT COALESCE(
    (SELECT SUM(amount_due) FROM sales
     WHERE customer_id = v_customer_id
       AND status = 'completed'
       AND deleted_at IS NULL),
    0
  ) - COALESCE(
    (SELECT SUM(amount) FROM payments
     WHERE customer_id = v_customer_id
       AND sale_id IS NULL  -- Unallocated payments reduce balance
       AND deleted_at IS NULL),
    0
  ) INTO v_new_balance;

  -- Update customer
  UPDATE customers
  SET
    current_balance = v_new_balance,
    updated_at = NOW()
  WHERE id = v_customer_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger on sales changes (completion, cancellation)
CREATE TRIGGER trg_update_customer_balance_from_sales
AFTER INSERT OR UPDATE OR DELETE ON sales
FOR EACH ROW
WHEN (
  (TG_OP = 'INSERT' AND NEW.status = 'completed')
  OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status)
  OR (TG_OP = 'DELETE' AND OLD.status = 'completed')
)
EXECUTE FUNCTION fn_update_customer_balance();

-- Trigger on payment changes
CREATE TRIGGER trg_update_customer_balance_from_payments
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION fn_update_customer_balance();

COMMENT ON FUNCTION fn_update_customer_balance IS
  'Maintains customer.current_balance by recalculating from:
   - All completed sales (adds amount_due)
   - All unallocated payments (subtracts amount)
   Runs whenever a sale is completed/cancelled or a payment is recorded.';
