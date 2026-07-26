-- ============================================================================
-- INVENTORY SYSTEM — COMPLETE TRIGGER AND CONSTRAINT SETUP
-- ============================================================================
-- Replaces the partial inventory trigger from migration 003.
-- Adds:
--   1. Non-negative stock constraint
--   2. Inventory decrease when sale is completed (with safety check)
--   3. Inventory restore when completed sale is cancelled
--   4. Block hard-delete of products that have sales history
-- ============================================================================

-- STEP 1: Remove old incomplete trigger from migration 003
DROP TRIGGER IF EXISTS trigger_update_inventory_from_sale ON sales;
DROP FUNCTION IF EXISTS update_inventory_from_sale();

-- STEP 2: Add constraint — quantity_on_hand can never go negative
ALTER TABLE inventory
  ADD CONSTRAINT inventory_quantity_non_negative
  CHECK (quantity_on_hand >= 0);

-- ============================================================================
-- TRIGGER: Decrease inventory when sale is completed
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
-- TRIGGER: Restore inventory when a completed sale is cancelled
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
-- TRIGGER: Prevent hard-deleting products with sales history
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
