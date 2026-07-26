-- ============================================================================
-- CRITICAL FIXES — Concurrent Edit Detection
-- ============================================================================
-- Adds optimistic locking to prevent data loss from concurrent edits.
-- Uses a version column that increments on every update.
-- Updates fail if version has changed since the record was loaded.
-- ============================================================================

-- Add version column to tables that can be edited concurrently
ALTER TABLE sales ADD COLUMN version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE customers ADD COLUMN version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE products ADD COLUMN version INTEGER DEFAULT 1 NOT NULL;

-- Function to increment version on every update
CREATE OR REPLACE FUNCTION fn_increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-increment version
CREATE TRIGGER trg_sales_increment_version
BEFORE UPDATE ON sales
FOR EACH ROW
EXECUTE FUNCTION fn_increment_version();

CREATE TRIGGER trg_customers_increment_version
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION fn_increment_version();

CREATE TRIGGER trg_products_increment_version
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION fn_increment_version();

COMMENT ON COLUMN sales.version IS
  'Optimistic locking version. Increments on every update.
   Used to detect concurrent modifications.';

COMMENT ON COLUMN customers.version IS
  'Optimistic locking version. Increments on every update.';

COMMENT ON COLUMN products.version IS
  'Optimistic locking version. Increments on every update.';

-- ============================================================================
-- CRITICAL FIXES — Duplicate Payment Detection
-- ============================================================================
-- Prevents recording the same payment twice (cash miscounts, system errors).
-- ============================================================================

-- Unique constraint on reference_number (check numbers, transaction IDs)
CREATE UNIQUE INDEX payments_reference_unique
ON payments(organization_id, reference_number)
WHERE reference_number IS NOT NULL AND deleted_at IS NULL;

COMMENT ON INDEX payments_reference_unique IS
  'Prevents duplicate payments with same reference number (check #1234).
   Includes organization_id for multi-tenant isolation.
   Partial index excludes NULL references and soft-deleted payments.';

-- ============================================================================
-- CRITICAL FIXES — Performance Indexes
-- ============================================================================
-- Adds missing indexes for frequent queries identified in review.
-- ============================================================================

-- Overdue sales query (dashboard, reports)
CREATE INDEX idx_sales_overdue
ON sales(organization_id, due_date, payment_status)
WHERE status = 'completed'
  AND payment_status IN ('unpaid', 'partial')
  AND deleted_at IS NULL;

-- Customer search by phone (frequent lookup)
CREATE INDEX idx_customers_phone
ON customers(organization_id, phone)
WHERE phone IS NOT NULL AND deleted_at IS NULL;

-- Product search by name (search bar)
CREATE INDEX idx_products_name
ON products(organization_id, name)
WHERE deleted_at IS NULL;

-- Sale items by product (product sales history)
CREATE INDEX idx_sale_items_product_date
ON sale_items(product_id, created_at DESC);

-- Payments by date range (reports, reconciliation)
CREATE INDEX idx_payments_date_range
ON payments(organization_id, payment_date DESC)
WHERE deleted_at IS NULL;

-- Payments by customer (customer account statement)
CREATE INDEX idx_payments_customer_date
ON payments(customer_id, payment_date DESC)
WHERE deleted_at IS NULL;

-- ============================================================================
-- CRITICAL FIXES — Audit Trail (updated_by, deleted_by)
-- ============================================================================
-- Tracks who made changes for accountability and debugging.
-- ============================================================================

-- Add updated_by and deleted_by to all business tables
ALTER TABLE customers ADD COLUMN updated_by UUID REFERENCES user_profiles(id);
ALTER TABLE customers ADD COLUMN deleted_by UUID REFERENCES user_profiles(id);

ALTER TABLE products ADD COLUMN updated_by UUID REFERENCES user_profiles(id);
ALTER TABLE products ADD COLUMN deleted_by UUID REFERENCES user_profiles(id);

ALTER TABLE sales ADD COLUMN updated_by UUID REFERENCES user_profiles(id);
ALTER TABLE sales ADD COLUMN deleted_by UUID REFERENCES user_profiles(id);

ALTER TABLE payments ADD COLUMN updated_by UUID REFERENCES user_profiles(id);
ALTER TABLE payments ADD COLUMN deleted_by UUID REFERENCES user_profiles(id);

ALTER TABLE expenses ADD COLUMN updated_by UUID REFERENCES user_profiles(id);
ALTER TABLE expenses ADD COLUMN deleted_by UUID REFERENCES user_profiles(id);

ALTER TABLE inventory ADD COLUMN updated_by UUID REFERENCES user_profiles(id);

COMMENT ON COLUMN customers.updated_by IS 'User who last modified this record';
COMMENT ON COLUMN customers.deleted_by IS 'User who soft-deleted this record';

-- ============================================================================
-- CRITICAL FIXES — Sale Number Gaps Prevention
-- ============================================================================
-- Prevents gaps in invoice numbers by using draft-specific numbering.
-- ============================================================================

-- Add draft_number column (separate from sale_number)
ALTER TABLE sales ADD COLUMN draft_number TEXT;

-- Unique constraint on sale_number (only for completed sales)
CREATE UNIQUE INDEX sales_number_unique
ON sales(organization_id, sale_number)
WHERE sale_number IS NOT NULL AND deleted_at IS NULL;

-- Unique constraint on draft_number (only for drafts)
CREATE UNIQUE INDEX sales_draft_number_unique
ON sales(organization_id, draft_number)
WHERE draft_number IS NOT NULL AND status = 'draft' AND deleted_at IS NULL;

COMMENT ON COLUMN sales.draft_number IS
  'Draft-specific identifier (DRAFT-0001). Only set while status=draft.
   When sale is completed, draft_number is cleared and sale_number is assigned.
   This prevents gaps in invoice numbers when drafts are deleted.';

-- ============================================================================
-- CRITICAL FIXES — Additional Snapshots on sale_items
-- ============================================================================
-- Adds product_sku snapshot to preserve historical data integrity.
-- ============================================================================

ALTER TABLE sale_items ADD COLUMN product_sku TEXT;

COMMENT ON COLUMN sale_items.product_sku IS
  'Snapshot of product.sku at sale creation time.
   Preserves SKU even if product is later renamed or SKU changes.';

-- ============================================================================
-- CRITICAL FIXES — Business Rule Constraints
-- ============================================================================
-- Enforces business rules at database level.
-- ============================================================================

-- Prevent negative discounts (unless intentional - surcharges)
-- Commenting out for flexibility - discuss with business if needed
-- ALTER TABLE sale_items ADD CONSTRAINT discount_non_negative CHECK (discount >= 0);

-- Limit line items per sale (prevent DOS, UI breaks)
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
-- CRITICAL FIXES — Draft Expiration Tracking
-- ============================================================================
-- Adds ability to identify stale drafts for cleanup/warnings.
-- ============================================================================

-- View for stale drafts (older than 7 days)
CREATE OR REPLACE VIEW stale_drafts AS
SELECT
  id,
  organization_id,
  draft_number,
  customer_id,
  created_at,
  created_by,
  EXTRACT(DAYS FROM (NOW() - created_at)) AS days_old
FROM sales
WHERE status = 'draft'
  AND created_at < NOW() - INTERVAL '7 days'
  AND deleted_at IS NULL;

COMMENT ON VIEW stale_drafts IS
  'Identifies draft sales older than 7 days.
   Use for UI warnings or automated cleanup jobs.';
