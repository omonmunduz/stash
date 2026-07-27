-- ============================================================================
-- BUSINESS LOGIC — TRIGGERS AND HELPER FUNCTIONS
-- ============================================================================
-- Migration order: schema → auth_helpers → row_level_security → business_logic (this file)
--
-- This file consolidates all database-layer business rules:
--   1. Auto-numbering (customer_code, sale_number, payment_number, expense_number)
--   2. Sale totals recalculation when items change
--   3. Sale payment status derived from payments
--   4. Customer balance maintained from completed sales and payments
--   5. Inventory deduction on sale completion, restoration on cancellation
--   6. Optimistic locking (version columns)
--   7. Safety constraints (sale item limits, product deletion guard)
--   8. updated_at maintenance
--
-- Scope: replaces the business logic scattered across migrations 003, 007, 008, 009.
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS — AUTO-NUMBERING
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_customer_code(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(customer_code FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_num
  FROM customers
  WHERE organization_id = org_id
  AND customer_code ~ '^CUST-[0-9]+$';

  RETURN 'CUST-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_customer_code IS
  'Generates next customer code: CUST-0001, CUST-0002, etc. Scoped to organization.';

CREATE OR REPLACE FUNCTION generate_sale_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  SELECT COALESCE(MAX(CAST(SUBSTRING(sale_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_num
  FROM sales
  WHERE organization_id = org_id
  AND sale_number ~ ('^INV-' || current_year || '-[0-9]+$');

  RETURN 'INV-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_sale_number IS
  'Generates next invoice number: INV-2026-0001. Resets annually. Scoped to organization.';

CREATE OR REPLACE FUNCTION generate_payment_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  SELECT COALESCE(MAX(CAST(SUBSTRING(payment_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_num
  FROM payments
  WHERE organization_id = org_id
  AND payment_number ~ ('^PAY-' || current_year || '-[0-9]+$');

  RETURN 'PAY-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_payment_number IS
  'Generates next payment number: PAY-2026-0001. Resets annually. Scoped to organization.';

CREATE OR REPLACE FUNCTION generate_expense_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  SELECT COALESCE(MAX(CAST(SUBSTRING(expense_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_num
  FROM expenses
  WHERE organization_id = org_id
  AND expense_number ~ ('^EXP-' || current_year || '-[0-9]+$');

  RETURN 'EXP-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_expense_number IS
  'Generates next expense number: EXP-2026-0001. Resets annually. Scoped to organization.';

-- ============================================================================
-- TRIGGER 0: Assign sale_number when a draft is completed
-- ============================================================================
-- 000001_schema.sql makes sale_number NULL for drafts and enforces
-- sales_completed_has_number: a completed sale must have one. Something has to
-- fill it at the moment of transition, and the column comment says a trigger
-- does. This is that trigger — without it, every attempt to complete a sale
-- fails the CHECK constraint.
--
-- BEFORE UPDATE, not AFTER: the constraint is evaluated on the row as written,
-- so an AFTER trigger runs too late to satisfy it.
--
-- On concurrency: two sessions completing sales simultaneously can read the same
-- MAX() and derive the same number. The loser hits the sales_number_unique
-- partial index and its transaction rolls back, which is the correct outcome for
-- a business where two people rarely finalize invoices in the same millisecond.
-- A gap-free sequence and lock-free concurrency cannot both hold; the schema
-- chose gap-free deliberately.
CREATE OR REPLACE FUNCTION fn_assign_sale_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sale_number IS NULL THEN
    NEW.sale_number := generate_sale_number(NEW.organization_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assign_sale_number
BEFORE UPDATE ON sales
FOR EACH ROW
WHEN (
  OLD.status IS DISTINCT FROM NEW.status
  AND NEW.status = 'completed'
)
EXECUTE FUNCTION fn_assign_sale_number();

COMMENT ON FUNCTION fn_assign_sale_number IS
  'Assigns the next INV-YYYY-NNNN number when a sale moves to completed.
   Leaves an already-set number alone, so re-completing a cancelled sale keeps
   its original number for the audit trail.';

-- ============================================================================
-- TRIGGER 1: Recalculate sale totals when items change
-- ============================================================================

-- On NEW/OLD handling: PL/pgSQL leaves NEW unassigned during DELETE and OLD
-- unassigned during INSERT, and reading a field off an unassigned record raises
-- "record NEW is not assigned yet". So these functions branch on TG_OP instead
-- of the shorter COALESCE(NEW.x, OLD.x), which fails on DELETE.
CREATE OR REPLACE FUNCTION fn_recalculate_sale_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_id UUID;
  v_new_subtotal DECIMAL(15,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_sale_id := OLD.sale_id;
  ELSE
    v_sale_id := NEW.sale_id;
  END IF;

  SELECT COALESCE(SUM(subtotal), 0) INTO v_new_subtotal
  FROM sale_items
  WHERE sale_id = v_sale_id;

  UPDATE sales
  SET
    subtotal = v_new_subtotal,
    total = v_new_subtotal + tax - discount,
    amount_due = (v_new_subtotal + tax - discount) - amount_paid,
    updated_at = NOW()
  WHERE id = v_sale_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
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
  IF TG_OP = 'DELETE' THEN
    v_sale_id := OLD.sale_id;
  ELSE
    v_sale_id := NEW.sale_id;
  END IF;

  -- Skip if payment is not linked to a sale (unallocated payment)
  IF v_sale_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
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

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_sale_payment_status_insert
AFTER INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION fn_update_sale_payment_status();

CREATE TRIGGER trg_update_sale_payment_status_update
AFTER UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION fn_update_sale_payment_status();

CREATE TRIGGER trg_update_sale_payment_status_delete
AFTER DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION fn_update_sale_payment_status();

COMMENT ON FUNCTION fn_update_sale_payment_status IS
  'Automatically updates sale.amount_paid, amount_due, and payment_status
   whenever a payment is recorded, updated, or deleted. Payment status is derived:
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
  -- Same customer_id column on both sales and payments, so no per-table branch
  -- is needed — only a DELETE-vs-rest branch for record availability.
  IF TG_OP = 'DELETE' THEN
    v_customer_id := OLD.customer_id;
  ELSE
    v_customer_id := NEW.customer_id;
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

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers on sales changes (completion, cancellation).
--
-- Split one-per-operation rather than a single AFTER INSERT OR UPDATE OR DELETE
-- with a TG_OP test in the WHEN clause. TG_OP is not in scope in a WHEN clause —
-- Postgres rejects it with 'column "tg_op" does not exist'. Each operation also
-- needs a different condition, and a WHEN clause may only reference the records
-- its own operation actually provides.
CREATE TRIGGER trg_update_customer_balance_from_sales_insert
AFTER INSERT ON sales
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION fn_update_customer_balance();

CREATE TRIGGER trg_update_customer_balance_from_sales_update
AFTER UPDATE ON sales
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.amount_due IS DISTINCT FROM NEW.amount_due)
EXECUTE FUNCTION fn_update_customer_balance();

CREATE TRIGGER trg_update_customer_balance_from_sales_delete
AFTER DELETE ON sales
FOR EACH ROW
WHEN (OLD.status = 'completed')
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

-- ============================================================================
-- TRIGGER 4: Decrease inventory when sale is completed
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_decrease_inventory_on_sale_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_insufficient_product TEXT;
BEGIN
  -- Safety check: ensure all products have sufficient stock
  -- (App layer validates first, this is the final database safeguard)
  SELECT p.name INTO v_insufficient_product
  FROM sale_items si
  JOIN inventory i
    ON i.product_id = si.product_id
   AND i.organization_id = NEW.organization_id
  JOIN products p ON p.id = si.product_id
  WHERE si.sale_id = NEW.id
    AND i.quantity_on_hand < si.quantity
  LIMIT 1;

  IF v_insufficient_product IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot complete sale: insufficient stock for product "%". Check inventory before completing.',
      v_insufficient_product;
  END IF;

  -- Decrease inventory for every sale item in this sale
  UPDATE inventory i
  SET
    quantity_on_hand = i.quantity_on_hand - si.quantity,
    updated_at = NOW()
  FROM sale_items si
  WHERE si.sale_id = NEW.id
    AND i.product_id = si.product_id
    AND i.organization_id = NEW.organization_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_decrease_inventory_on_sale_completed
AFTER UPDATE ON sales
FOR EACH ROW
WHEN (
  OLD.status IS DISTINCT FROM NEW.status
  AND OLD.status = 'draft'
  AND NEW.status = 'completed'
)
EXECUTE FUNCTION fn_decrease_inventory_on_sale_completed();

COMMENT ON FUNCTION fn_decrease_inventory_on_sale_completed IS
  'Automatically decreases inventory when a sale moves from draft to completed.
   Raises an exception (rolls back the transaction) if any product has
   insufficient stock. This is the final safeguard — the app layer validates first.';

-- ============================================================================
-- TRIGGER 5: Restore inventory when a completed sale is cancelled
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_restore_inventory_on_sale_cancelled()
RETURNS TRIGGER AS $$
BEGIN
  -- Restore inventory for every sale item — reverses the decrease
  UPDATE inventory i
  SET
    quantity_on_hand = i.quantity_on_hand + si.quantity,
    updated_at = NOW()
  FROM sale_items si
  WHERE si.sale_id = NEW.id
    AND i.product_id = si.product_id
    AND i.organization_id = NEW.organization_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_restore_inventory_on_sale_cancelled
AFTER UPDATE ON sales
FOR EACH ROW
WHEN (
  OLD.status IS DISTINCT FROM NEW.status
  AND OLD.status = 'completed'
  AND NEW.status = 'cancelled'
)
EXECUTE FUNCTION fn_restore_inventory_on_sale_cancelled();

COMMENT ON FUNCTION fn_restore_inventory_on_sale_cancelled IS
  'Automatically restores inventory when a completed sale is cancelled.
   Cancelling a draft sale has no inventory effect (inventory was never reduced).
   Payments are NOT automatically reversed — handle refunds separately.';

-- ============================================================================
-- TRIGGER 6: Prevent hard-deleting products with sales history
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_prevent_product_delete_with_sales()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM sale_items WHERE product_id = OLD.id LIMIT 1) THEN
    RAISE EXCEPTION
      'Cannot delete product "%": it has sales history. Deactivate it instead (is_active = false).',
      OLD.name;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_product_delete_with_sales
BEFORE DELETE ON products
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_product_delete_with_sales();

COMMENT ON FUNCTION fn_prevent_product_delete_with_sales IS
  'Prevents hard-deleting a product that has appeared in any sale.
   Use soft-delete (deleted_at = NOW(), is_active = false) instead.
   This preserves invoice history and prevents orphaned sale_items records.';

-- ============================================================================
-- TRIGGER 7: Limit line items per sale (prevent DOS)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_check_sale_items_limit()
RETURNS TRIGGER AS $$
DECLARE
  item_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO item_count
  FROM sale_items
  WHERE sale_id = NEW.sale_id;

  IF item_count >= 500 THEN
    RAISE EXCEPTION 'A sale cannot have more than 500 line items';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sale_items_limit
BEFORE INSERT ON sale_items
FOR EACH ROW
EXECUTE FUNCTION fn_check_sale_items_limit();

COMMENT ON FUNCTION fn_check_sale_items_limit IS
  'Prevents sales from having more than 500 line items.
   Protects against accidental/malicious bulk inserts that would break UI.';

-- ============================================================================
-- TRIGGER 8: Every product gets exactly one inventory row
-- ============================================================================
-- The schema comment on `inventory` states this invariant: every product has
-- exactly one inventory row, created automatically. It matters for correctness,
-- not just convenience — fn_decrease_inventory_on_sale_completed below joins
-- sale_items to inventory. A missing row makes that join match zero rows, so the
-- stock deduction silently does nothing and the sale completes anyway. The
-- insufficient-stock guard would miss it too, for the same reason.
CREATE OR REPLACE FUNCTION fn_create_inventory_for_product()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO inventory (organization_id, product_id, quantity_on_hand)
  VALUES (NEW.organization_id, NEW.id, 0)
  ON CONFLICT (organization_id, product_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_inventory_for_product
AFTER INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION fn_create_inventory_for_product();

COMMENT ON FUNCTION fn_create_inventory_for_product IS
  'Creates the inventory row for a new product at quantity 0, upholding the
   one-row-per-product invariant that stock queries and the sale-completion
   deduction both rely on.';

-- ============================================================================
-- NOT INCLUDED, AND WHY
-- ============================================================================
-- updated_at triggers: already created in 000001_schema.sql. Re-creating them
--   here would fail — CREATE TRIGGER has no IF NOT EXISTS.
--
-- Optimistic locking (version columns, fn_increment_version): dropped with the
--   old migrations. The canonical schema does not declare a version column on
--   any table, no repository reads or writes one, and no UI surfaces a
--   concurrent-edit conflict. Adding it now would also put a second BEFORE
--   UPDATE trigger on sales, customers, and products alongside the updated_at
--   ones, where firing order is alphabetical by trigger name. Revisit when
--   there is a real multi-user editing conflict to solve.
--
-- draft_number, stale_drafts view, updated_by/deleted_by: also dropped with the
--   old migrations, and deliberately absent from the canonical schema —
--   draft_number contradicted the sale_number-on-completion design that
--   000001_schema.sql documents at length.
