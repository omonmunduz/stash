-- ============================================================================
-- HELPER FUNCTIONS FOR BUSINESS LOGIC
-- ============================================================================

-- Function to generate next customer code
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

-- Function to generate next sale number
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

-- Function to generate next payment number
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

-- Function to generate next expense number
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

-- ============================================================================
-- TRIGGER FUNCTIONS FOR BUSINESS LOGIC
-- ============================================================================

-- Function to update sale totals when sale items change
CREATE OR REPLACE FUNCTION update_sale_totals()
RETURNS TRIGGER AS $$
DECLARE
  sale_id_to_update UUID;
BEGIN
  -- Determine which sale to update
  IF TG_OP = 'DELETE' THEN
    sale_id_to_update := OLD.sale_id;
  ELSE
    sale_id_to_update := NEW.sale_id;
  END IF;

  -- Recalculate sale totals
  UPDATE sales
  SET
    subtotal = COALESCE((
      SELECT SUM(subtotal)
      FROM sale_items
      WHERE sale_id = sale_id_to_update
    ), 0),
    total = COALESCE((
      SELECT SUM(subtotal)
      FROM sale_items
      WHERE sale_id = sale_id_to_update
    ), 0) + COALESCE(tax, 0) - COALESCE(discount, 0),
    amount_due = COALESCE((
      SELECT SUM(subtotal)
      FROM sale_items
      WHERE sale_id = sale_id_to_update
    ), 0) + COALESCE(tax, 0) - COALESCE(discount, 0) - COALESCE(amount_paid, 0)
  WHERE id = sale_id_to_update;

  -- Update payment status
  UPDATE sales
  SET payment_status = CASE
    WHEN amount_due <= 0 THEN 'paid'::payment_status
    WHEN amount_paid > 0 THEN 'partial'::payment_status
    ELSE 'unpaid'::payment_status
  END
  WHERE id = sale_id_to_update;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update sale totals
CREATE TRIGGER trigger_update_sale_totals
AFTER INSERT OR UPDATE OR DELETE ON sale_items
FOR EACH ROW EXECUTE FUNCTION update_sale_totals();

-- Function to update customer balance when sales change
CREATE OR REPLACE FUNCTION update_customer_balance_from_sale()
RETURNS TRIGGER AS $$
DECLARE
  customer_id_to_update UUID;
BEGIN
  -- Determine which customer to update
  IF TG_OP = 'DELETE' THEN
    customer_id_to_update := OLD.customer_id;
  ELSE
    customer_id_to_update := NEW.customer_id;
  END IF;

  -- Recalculate customer balance
  UPDATE customers
  SET current_balance = COALESCE((
    SELECT SUM(amount_due)
    FROM sales
    WHERE customer_id = customer_id_to_update
    AND status = 'completed'
    AND deleted_at IS NULL
  ), 0)
  WHERE id = customer_id_to_update;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update customer balance from sales
CREATE TRIGGER trigger_update_customer_balance_from_sale
AFTER INSERT OR UPDATE OR DELETE ON sales
FOR EACH ROW EXECUTE FUNCTION update_customer_balance_from_sale();

-- Function to update sale payment status when payments change
CREATE OR REPLACE FUNCTION update_sale_from_payment()
RETURNS TRIGGER AS $$
DECLARE
  sale_id_to_update UUID;
BEGIN
  -- Determine which sale to update
  IF TG_OP = 'DELETE' THEN
    sale_id_to_update := OLD.sale_id;
  ELSE
    sale_id_to_update := NEW.sale_id;
  END IF;

  -- Skip if no sale_id (unallocated payment)
  IF sale_id_to_update IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Recalculate amount paid
  UPDATE sales
  SET
    amount_paid = COALESCE((
      SELECT SUM(amount)
      FROM payments
      WHERE sale_id = sale_id_to_update
      AND deleted_at IS NULL
    ), 0),
    amount_due = total - COALESCE((
      SELECT SUM(amount)
      FROM payments
      WHERE sale_id = sale_id_to_update
      AND deleted_at IS NULL
    ), 0)
  WHERE id = sale_id_to_update;

  -- Update payment status
  UPDATE sales
  SET payment_status = CASE
    WHEN amount_due <= 0 THEN 'paid'::payment_status
    WHEN amount_paid > 0 THEN 'partial'::payment_status
    ELSE 'unpaid'::payment_status
  END
  WHERE id = sale_id_to_update;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update sale from payments
CREATE TRIGGER trigger_update_sale_from_payment
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION update_sale_from_payment();

-- Function to update inventory when sale is completed
CREATE OR REPLACE FUNCTION update_inventory_from_sale()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
BEGIN
  -- Only process when sale status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Reduce inventory for each sale item
    FOR item IN
      SELECT product_id, quantity
      FROM sale_items
      WHERE sale_id = NEW.id
    LOOP
      -- Update or insert inventory record
      INSERT INTO inventory (organization_id, product_id, warehouse_id, quantity_on_hand)
      VALUES (NEW.organization_id, item.product_id, NULL, -item.quantity)
      ON CONFLICT (organization_id, product_id, warehouse_id)
      DO UPDATE SET
        quantity_on_hand = inventory.quantity_on_hand - item.quantity,
        updated_at = NOW();
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update inventory from completed sales
CREATE TRIGGER trigger_update_inventory_from_sale
AFTER INSERT OR UPDATE ON sales
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION update_inventory_from_sale();
