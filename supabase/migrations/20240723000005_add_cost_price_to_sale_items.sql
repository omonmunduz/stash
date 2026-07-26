-- ============================================================================
-- ADD cost_price SNAPSHOT TO sale_items
-- ============================================================================
-- Purpose: Enable historical gross profit calculation per invoice.
--
-- Without this column, if product.cost_price changes after a sale is recorded,
-- the system cannot know what the cost was at the time of the transaction.
--
-- With this column:
--   Gross profit per item = (unit_price - cost_price) * quantity
--   Gross profit per sale = SUM(item gross profits)
--   Net profit            = Gross profit - Expenses
--
-- This column is set by the application at sale creation time
-- (copied from product.cost_price). It is a snapshot, never updated after.
-- ============================================================================

ALTER TABLE sale_items
  ADD COLUMN cost_price DECIMAL(15, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN sale_items.cost_price IS
  'Snapshot: cost price at time of sale. Used for gross profit calculation. Never updated after initial insert.';
