-- ============================================================================
-- EDITABLE SALES AND PAYMENTS
-- ============================================================================
-- The shop owner needs to fix mistakes days after the fact: wrong product, wrong
-- quantity, wrong price, wrong payment amount. Until now a completed sale was
-- effectively frozen — the only correction available was cancelling the whole
-- thing and re-entering it, which burns an invoice number and loses the history
-- of what was actually handed over.
--
-- Four things have to hold after any such edit:
--   1. The sale's own total matches its line items      (already true — trigger)
--   2. Stock reflects what actually left the shelf      (new — section 3)
--   3. Payments still land oldest-debt-first            (new — section 4)
--   4. The customer's balance and status follow          (already true — trigger)
--
-- (2) and (3) are the gaps. Deducting stock only at completion means a quantity
-- corrected afterwards never reaches inventory. And payment_allocations are
-- written once by record_customer_payment and never revisited, so any change to
-- what is owed leaves them describing a split that no longer adds up.
--
-- Section 4 is the load-bearing piece: one reallocation routine that replays a
-- customer's payments oldest-first from scratch. Every edit path calls it, so
-- there is one definition of "oldest-debt-first" rather than four
-- almost-identical patches that drift.
--
-- Migration order: this is additive and runs after 20260730000001.
-- ============================================================================

-- ============================================================================
-- 1. AUDIT COLUMNS
-- ============================================================================
-- 000004_business_logic.sql dropped updated_by deliberately, on the grounds that
-- nothing read it. That reasoning held while sales were immutable. Now that a
-- line item can be rewritten weeks later, "who changed this and when" is the
-- first question anyone asks about a total that looks wrong, so the columns come
-- back — but only on the two tables that are now editable after the fact.
--
-- No FK cascade concerns: user_profiles rows are soft-deleted, and ON DELETE SET
-- NULL keeps an edit attributable to "someone since removed" rather than
-- blocking the profile delete.

ALTER TABLE sales
  ADD COLUMN updated_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

ALTER TABLE sale_items
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN updated_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Payments are corrected after the fact for the same reasons sales are — a figure
-- written down wrong, or a payment recorded against the wrong day — so the same
-- question applies to them. updated_at is already stamped by trg_payments_updated_at.
ALTER TABLE payments
  ADD COLUMN updated_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN sales.updated_by IS
  'Who last edited this sale. NULL means it has not been touched since creation
   (or was edited by a user whose profile was since deleted).';
COMMENT ON COLUMN payments.updated_by IS
  'Who last corrected this payment. NULL means it is as it was recorded.';
COMMENT ON COLUMN sale_items.updated_at IS
  'Stamped on every UPDATE by trg_sale_items_updated_at. Equal to created_at for
   a line that has never been corrected.';
COMMENT ON COLUMN sale_items.updated_by IS
  'Who last corrected this line. NULL means it is still as it was rung up.';

-- sale_items was the one mutable-content table without this trigger, because
-- until now its rows were only ever inserted or deleted.
CREATE TRIGGER trg_sale_items_updated_at
  BEFORE UPDATE ON sale_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. HELPER: is this sale currently holding stock?
-- ============================================================================
-- Stock is deducted when a sale moves draft → completed and restored when it
-- moves completed → cancelled. So a line item's stock effect is live only while
-- the parent sits at 'completed'. Editing a draft's lines must not touch
-- inventory (nothing was deducted yet); editing a cancelled sale's lines must
-- not either (already restored).

CREATE OR REPLACE FUNCTION public.fn_sale_holds_stock(p_sale_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT status = 'completed' AND deleted_at IS NULL FROM sales WHERE id = p_sale_id),
    FALSE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.fn_sale_holds_stock IS
  'TRUE when this sale has already taken goods off the shelf, so a line-item
   change must move inventory by the difference.';

-- ============================================================================
-- 3. STOCK FOLLOWS LINE-ITEM EDITS
-- ============================================================================
-- Applies the delta, not the absolute quantity. Correcting 5 → 3 puts 2 back;
-- correcting 3 → 5 takes 2 more. Adding a line to a completed sale deducts it in
-- full, removing one restores it in full.
--
-- The insufficient-stock check raises a named error before the
-- CHECK (quantity_on_hand >= 0) constraint would fire, matching what
-- fn_decrease_inventory_on_sale_completed does at completion time. An edit that
-- would oversell fails and rolls back rather than driving stock negative.

CREATE OR REPLACE FUNCTION public.fn_sale_items_adjust_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_available DECIMAL(15,3);
  v_name      TEXT;
BEGIN
  -- ── Restore the old line's claim on stock ────────────────────────────────
  -- Runs for DELETE, and for the UPDATE half of a change. Doing it as
  -- restore-then-deduct rather than a net delta keeps a product swap
  -- (line changed from Cookies to Chips) correct without a special case.
  IF TG_OP IN ('UPDATE', 'DELETE') AND public.fn_sale_holds_stock(OLD.sale_id) THEN
    UPDATE inventory
    SET quantity_on_hand = quantity_on_hand + OLD.quantity,
        updated_at       = NOW()
    WHERE product_id      = OLD.product_id
      AND organization_id = OLD.organization_id;
  END IF;

  -- ── Take the new line's claim ────────────────────────────────────────────
  IF TG_OP IN ('INSERT', 'UPDATE') AND public.fn_sale_holds_stock(NEW.sale_id) THEN
    SELECT i.quantity_on_hand, p.name INTO v_available, v_name
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    WHERE i.product_id      = NEW.product_id
      AND i.organization_id = NEW.organization_id;

    IF v_available IS NULL THEN
      RAISE EXCEPTION 'No inventory record for that product. It may have been deleted.';
    END IF;

    -- The wording is load-bearing: SaleService.toMessage matches on
    -- 'Insufficient stock to increase' and passes the rest through verbatim, so
    -- the person editing sees the product and both numbers.
    IF v_available < NEW.quantity THEN
      RAISE EXCEPTION
        'Insufficient stock to increase "%": % on hand, % needed. Adjust inventory first, or lower the quantity.',
        v_name, v_available, NEW.quantity;
    END IF;

    UPDATE inventory
    SET quantity_on_hand = quantity_on_hand - NEW.quantity,
        updated_at       = NOW()
    WHERE product_id      = NEW.product_id
      AND organization_id = NEW.organization_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- AFTER, so fn_recalculate_sale_totals (also AFTER, and alphabetically later on
-- INSERT/UPDATE/DELETE of the same row) is not depended on for ordering — the
-- two touch different tables and neither reads the other's output.
--
-- Deliberately NOT fired during create_sale_with_items' item inserts: those run
-- while the sale is still 'draft', so fn_sale_holds_stock returns FALSE and the
-- deduction is left to the completion trigger. Without that split, a new sale
-- would have its stock taken twice.
CREATE TRIGGER trg_sale_items_adjust_stock
AFTER INSERT OR UPDATE OR DELETE ON sale_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_sale_items_adjust_stock();

COMMENT ON FUNCTION public.fn_sale_items_adjust_stock IS
  'Keeps inventory in step with line-item edits on an already-completed sale, by
   restoring the old quantity and taking the new one. No-op while the parent sale
   is a draft or cancelled, since it is not holding stock in either state.';

-- ============================================================================
-- 4. REALLOCATION: replay a customer's payments oldest-debt-first
-- ============================================================================
-- The single source of truth for "where does this customer's money sit".
--
-- Why replay everything instead of patching the affected rows: allocation is
-- order-dependent. Lowering a payment, cancelling an invoice, or editing a total
-- can free money in the middle of the chain, and the correct new answer is
-- whatever oldest-debt-first would have produced had the corrected figures been
-- true all along. Any incremental patch is an approximation of that; a replay is
-- that, by construction. It also means record_customer_payment and every edit
-- path agree on the rule, because there is only one implementation of it.
--
-- Cost is bounded by one customer's payment count — tens of rows for a shop like
-- this, not thousands. The per-row triggers on payment_allocations fire during
-- the wipe and refire during the rebuild, which is redundant work but keeps the
-- function honest: it never leaves a denormalized column stale even if it errors
-- partway and rolls back.

CREATE OR REPLACE FUNCTION public.fn_reallocate_customer_payments(p_customer_id UUID)
RETURNS VOID AS $$
DECLARE
  v_payment   RECORD;
  v_sale      RECORD;
  v_remaining DECIMAL(15,2);
  v_slice     DECIMAL(15,2);
BEGIN
  IF p_customer_id IS NULL THEN
    RETURN;
  END IF;

  -- Same lock record_customer_payment takes. Two corrections landing at once
  -- would otherwise both replay from the same starting state.
  PERFORM 1 FROM customers WHERE id = p_customer_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Wipe. Allocations of voided payments go too: they describe money that was
  -- taken back, and leaving them would let a voided payment keep an invoice
  -- looking settled. The payment rows themselves are untouched, so the ledger
  -- still shows what was received and reversed.
  DELETE FROM payment_allocations
  WHERE payment_id IN (
    SELECT id FROM payments WHERE customer_id = p_customer_id
  );

  -- Rebuild. Payments in the order they were received, each spread across the
  -- oldest still-open invoices. A cancelled or draft sale is not in the set, so
  -- money that was sitting on one is released to credit here.
  FOR v_payment IN
    SELECT id, organization_id, amount
    FROM payments
    WHERE customer_id = p_customer_id
      AND deleted_at IS NULL
    ORDER BY payment_date ASC, created_at ASC
  LOOP
    v_remaining := v_payment.amount;

    FOR v_sale IN
      SELECT id, amount_due
      FROM sales
      WHERE customer_id = p_customer_id
        AND status = 'completed'
        AND deleted_at IS NULL
        AND amount_due > 0
      ORDER BY sale_date ASC, created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;

      v_slice := LEAST(v_remaining, v_sale.amount_due);

      INSERT INTO payment_allocations (organization_id, payment_id, sale_id, amount)
      VALUES (v_payment.organization_id, v_payment.id, v_sale.id, v_slice);

      v_remaining := v_remaining - v_slice;
    END LOOP;
    -- Anything left is credit on the account, same as a fresh overpayment.
  END LOOP;

  -- The per-row triggers have kept each touched sale current, but a sale that
  -- lost its last allocation in the wipe and gained none back was never visited
  -- by the rebuild. Sweep every sale on the tab so none is left reading paid.
  FOR v_sale IN
    SELECT id FROM sales WHERE customer_id = p_customer_id AND deleted_at IS NULL
  LOOP
    PERFORM public.fn_recalc_sale_payment(v_sale.id);
  END LOOP;

  PERFORM public.fn_recalc_customer_balance(p_customer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.fn_reallocate_customer_payments IS
  'Replays every non-voided payment for one customer against their open invoices
   oldest-first, from scratch. The one definition of oldest-debt-first that all
   edit paths share. Locks the customer row.';

-- ============================================================================
-- 5. CANCELLING A SALE RELEASES ITS PAYMENTS
-- ============================================================================
-- SaleService.cancel documents that payments on a cancelled sale "become account
-- credit instead of silently disappearing". That was not what happened: the
-- allocation rows survived, still counted as applied, while the sale itself
-- dropped out of the balance for being no longer 'completed'. The money stopped
-- counting as debt AND as credit — it left the balance entirely.
--
-- Reallocating on cancellation makes the documented behaviour real: the freed
-- money moves to the customer's other open invoices, and any surplus shows as
-- credit.
--
-- No recursion risk: this fires only on a status transition, and reallocation
-- never writes sales.status.

CREATE OR REPLACE FUNCTION public.fn_sale_cancelled_release_payments()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.fn_reallocate_customer_payments(NEW.customer_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER trg_sale_cancelled_release_payments
AFTER UPDATE OF status ON sales
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled')
EXECUTE FUNCTION public.fn_sale_cancelled_release_payments();

COMMENT ON FUNCTION public.fn_sale_cancelled_release_payments IS
  'Frees the payments that were sitting on a cancelled invoice, so they land on
   the customer''s remaining debt or show as credit.';

-- ============================================================================
-- 6. RPCs FOR LINE-ITEM EDITING
-- ============================================================================
-- One transaction per edit: mutate the line, then reallocate. Split into two
-- client calls, a failure between them would leave the sale's total correct and
-- its payment split describing the old total — the exact inconsistency the
-- feature exists to prevent.
--
-- Each RPC re-derives the price snapshot rules from the catalog rather than
-- trusting the client, and each stamps updated_by from auth.uid().
--
-- Authorization: these are SECURITY DEFINER, so RLS on sale_items does not
-- apply inside them. Each therefore repeats the check that
-- sale_items_*_follows_sale would have made — org match, plus manager-or-above
-- or authorship of the parent sale.

-- p_organization_id comes from the caller (the service already resolved it from
-- the session) and is checked against current_organization_id() rather than
-- trusted. A client that passes another org's id gets 'Sale not found.' — the
-- same answer as a nonexistent sale, so neither confirms the record exists.
CREATE OR REPLACE FUNCTION public.fn_assert_can_edit_sale(
  p_organization_id UUID,
  p_sale_id         UUID
)
RETURNS sales AS $$
DECLARE
  v_sale sales;
BEGIN
  IF p_organization_id IS DISTINCT FROM public.current_organization_id() THEN
    RAISE EXCEPTION 'Sale not found.';
  END IF;

  SELECT * INTO v_sale
  FROM sales
  WHERE id = p_sale_id
    AND organization_id = p_organization_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found.';
  END IF;

  IF NOT (public.has_role_or_above('manager') OR v_sale.created_by = auth.uid()) THEN
    RAISE EXCEPTION 'You do not have permission to edit this sale.';
  END IF;

  -- Wording matched by SaleService.toMessage ('cancelled sale cannot be edited'),
  -- which rephrases it for the screen.
  IF v_sale.status = 'cancelled' THEN
    RAISE EXCEPTION 'A cancelled sale cannot be edited. Reinstate it first.';
  END IF;

  RETURN v_sale;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.fn_assert_can_edit_sale IS
  'Loads a sale for editing, or raises. Mirrors the sale_items RLS policies for
   the SECURITY DEFINER RPCs, which bypass them.';

-- ── Add or correct a line ───────────────────────────────────────────────────
-- One entry point for both, branching on p_item_id. The editor UI has a single
-- save path — the same draft row is used to add a line and to correct one — so
-- splitting this into two functions would only move the branch into the client
-- and give the two cases room to drift on price-snapshot rules.

CREATE OR REPLACE FUNCTION public.upsert_sale_item(
  p_organization_id UUID,
  p_sale_id         UUID,
  p_item_id         UUID          DEFAULT NULL,
  p_product_id      UUID          DEFAULT NULL,
  p_quantity        DECIMAL(15,3) DEFAULT NULL,
  p_unit_price      DECIMAL(15,2) DEFAULT NULL,
  p_discount        DECIMAL(15,2) DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_sale    sales;
  v_item    sale_items;
  v_product RECORD;
  v_qty     DECIMAL(15,3);
  v_price   DECIMAL(15,2);
  v_disc    DECIMAL(15,2);
  v_item_id UUID;
BEGIN
  v_sale := public.fn_assert_can_edit_sale(p_organization_id, p_sale_id);

  IF p_item_id IS NULL THEN
    -- ── New line ───────────────────────────────────────────────────────────
    IF p_product_id IS NULL THEN
      RAISE EXCEPTION 'Pick a product for this line.';
    END IF;

    v_qty  := p_quantity;
    v_disc := COALESCE(p_discount, 0);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero.';
    END IF;

    SELECT id, name, sku, sale_price, cost_price INTO v_product
    FROM products
    WHERE id = p_product_id
      AND organization_id = v_sale.organization_id
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found in this organization.';
    END IF;

    -- NULL price means "use the catalog", matching create_sale_with_items.
    v_price := COALESCE(p_unit_price, v_product.sale_price);

    IF (v_qty * v_price) - v_disc < 0 THEN
      RAISE EXCEPTION 'The discount is more than the line is worth.';
    END IF;

    INSERT INTO sale_items (
      organization_id, sale_id, product_id, product_name, product_sku,
      quantity, unit_price, cost_price, discount, subtotal, updated_by
    ) VALUES (
      v_sale.organization_id, p_sale_id, v_product.id, v_product.name, v_product.sku,
      v_qty, v_price, v_product.cost_price, v_disc,
      (v_qty * v_price) - v_disc, auth.uid()
    )
    RETURNING id INTO v_item_id;
  ELSE
    -- ── Correct an existing line ───────────────────────────────────────────
    -- Scoped to p_sale_id as well as the id, so an item id belonging to another
    -- sale reads as "not on this sale" instead of being edited through the
    -- permission check that was made for a different parent.
    SELECT * INTO v_item
    FROM sale_items
    WHERE id = p_item_id
      AND sale_id = p_sale_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Line not found on this sale.';
    END IF;

    v_item_id := v_item.id;

    -- NULL means "leave this field alone", so the caller can send only what
    -- changed. Distinguishing that from "set to zero" is why quantity and price
    -- are validated after the COALESCE rather than on the raw parameter.
    v_qty  := COALESCE(p_quantity, v_item.quantity);
    v_disc := COALESCE(p_discount, v_item.discount);

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero.';
    END IF;

    IF p_product_id IS NOT NULL AND p_product_id <> v_item.product_id THEN
      -- Product swapped: re-snapshot name, sku and cost from the new product, and
      -- take its catalog price unless the caller supplied one. Keeping the old
      -- unit_price would silently price Chips at the Cookies rate.
      SELECT id, name, sku, sale_price, cost_price INTO v_product
      FROM products
      WHERE id = p_product_id
        AND organization_id = v_sale.organization_id
        AND deleted_at IS NULL;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found in this organization.';
      END IF;

      v_price := COALESCE(p_unit_price, v_product.sale_price);

      IF (v_qty * v_price) - v_disc < 0 THEN
        RAISE EXCEPTION 'The discount is more than the line is worth.';
      END IF;

      UPDATE sale_items
      SET product_id   = v_product.id,
          product_name = v_product.name,
          product_sku  = v_product.sku,
          cost_price   = v_product.cost_price,
          quantity     = v_qty,
          unit_price   = v_price,
          discount     = v_disc,
          subtotal     = (v_qty * v_price) - v_disc,
          updated_by   = auth.uid()
      WHERE id = v_item_id;
    ELSE
      v_price := COALESCE(p_unit_price, v_item.unit_price);

      IF (v_qty * v_price) - v_disc < 0 THEN
        RAISE EXCEPTION 'The discount is more than the line is worth.';
      END IF;

      -- cost_price is untouched on purpose: it is a snapshot of what the shop paid
      -- at the time, and rewriting it would change gross profit on a historical
      -- invoice.
      UPDATE sale_items
      SET quantity   = v_qty,
          unit_price = v_price,
          discount   = v_disc,
          subtotal   = (v_qty * v_price) - v_disc,
          updated_by = auth.uid()
      WHERE id = v_item_id;
    END IF;
  END IF;

  UPDATE sales SET updated_by = auth.uid(), updated_at = NOW() WHERE id = p_sale_id;

  PERFORM public.fn_reallocate_customer_payments(v_sale.customer_id);

  RETURN v_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.upsert_sale_item IS
  'Adds a line when p_item_id is NULL, otherwise corrects that line. Moves stock
   by the difference if the sale is already completed, re-snapshots product fields
   on a product swap, then reallocates the customer''s payments oldest-first.
   p_unit_price NULL uses the catalog price on a new line or a product swap, and
   leaves the historical price alone otherwise.';

-- ── Remove a line ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.remove_sale_item(
  p_organization_id UUID,
  p_sale_id         UUID,
  p_item_id         UUID
)
RETURNS VOID AS $$
DECLARE
  v_sale  sales;
  v_count INTEGER;
BEGIN
  v_sale := public.fn_assert_can_edit_sale(p_organization_id, p_sale_id);

  SELECT COUNT(*) INTO v_count FROM sale_items WHERE sale_id = p_sale_id;

  -- Checked before the delete, and phrased as "last line on a sale" because
  -- SaleService.toMessage matches that phrase to offer deleting the transaction
  -- instead. A completed sale with no lines is a numbered invoice for nothing,
  -- and cancelling is the operation that actually restores stock and frees the
  -- payments.
  IF v_count <= 1 THEN
    RAISE EXCEPTION
      'Cannot remove the last line on a sale. Cancel the whole sale instead of emptying it.';
  END IF;

  DELETE FROM sale_items
  WHERE id = p_item_id
    AND sale_id = p_sale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Line not found on this sale.';
  END IF;

  UPDATE sales SET updated_by = auth.uid(), updated_at = NOW() WHERE id = p_sale_id;

  PERFORM public.fn_reallocate_customer_payments(v_sale.customer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.remove_sale_item IS
  'Removes a line, restoring its stock if the sale is completed, then reallocates.
   Refuses on the last remaining line — cancel the sale instead.';

-- ============================================================================
-- 7. RPC: correct a payment's amount
-- ============================================================================
-- payments.amount was previously unchangeable from the app: UpdatePaymentInput
-- omits it, and schemas.ts explains why — the trigger would re-derive each
-- invoice from allocations that still described the old figure, so lowering a
-- payment left invoices reading paid and produced a phantom credit.
--
-- With a reallocation routine that is no longer true. Changing the amount and
-- replaying gives exactly the state that recording the correct figure in the
-- first place would have produced.

CREATE OR REPLACE FUNCTION public.update_payment_amount(
  p_organization_id UUID,
  p_payment_id      UUID,
  p_amount          DECIMAL(15,2)
)
RETURNS VOID AS $$
DECLARE
  v_payment payments;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.';
  END IF;

  -- Checked against the session rather than trusted, as in fn_assert_can_edit_sale.
  IF p_organization_id IS DISTINCT FROM public.current_organization_id() THEN
    RAISE EXCEPTION 'Payment not found.';
  END IF;

  SELECT * INTO v_payment
  FROM payments
  WHERE id = p_payment_id
    AND organization_id = p_organization_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found.';
  END IF;

  IF NOT public.has_role_or_above('manager') THEN
    RAISE EXCEPTION 'You do not have permission to change a payment amount.';
  END IF;

  UPDATE payments
  SET amount     = p_amount,
      updated_by = auth.uid()
  WHERE id = p_payment_id;

  PERFORM public.fn_reallocate_customer_payments(v_payment.customer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.update_payment_amount IS
  'Corrects a recorded payment''s amount and replays the customer''s allocations
   oldest-debt-first. Manager or above.';

-- ============================================================================
-- 8. VOIDING AND RE-DATING A PAYMENT REALLOCATE
-- ============================================================================
-- Two edit paths reach payments without going through update_payment_amount, and
-- both change the FIFO answer:
--
--   * Void. PaymentRepository.delete soft-deletes the row directly. That fires
--     fn_payment_changed_recalc_sales, which recalculates the invoices the
--     payment touched but leaves its allocation rows in place and never re-runs
--     FIFO — so the freed money never rolled onto the customer's other open
--     invoices.
--   * Re-dating. Allocation order is payment_date ASC, so moving a payment
--     earlier or later changes which invoice it covers. The repository writes
--     payment_date in a plain patch.
--
-- A trigger rather than an RPC, because the repository already performs both as
-- ordinary UPDATEs and the correction belongs wherever the column changes — an
-- RPC would only be honoured by the one caller that remembered to use it.
--
-- No recursion: reallocation writes payment_allocations, sales and customers,
-- never payments.
--
-- On a void this fires alongside the existing trg_payment_changed_recalc_sales.
-- Postgres runs same-event triggers in name order, and trg_payment_changed sorts
-- before trg_payment_reallocate, so the full replay runs last and its answer is
-- the one that stands. The earlier trigger's work is redundant, not wrong.

CREATE OR REPLACE FUNCTION public.fn_payment_reallocate_on_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.fn_reallocate_customer_payments(NEW.customer_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER trg_payment_reallocate_on_change
AFTER UPDATE OF deleted_at, payment_date ON payments
FOR EACH ROW
WHEN (
  OLD.deleted_at   IS DISTINCT FROM NEW.deleted_at
  OR OLD.payment_date IS DISTINCT FROM NEW.payment_date
)
EXECUTE FUNCTION public.fn_payment_reallocate_on_change();

COMMENT ON FUNCTION public.fn_payment_reallocate_on_change IS
  'Replays a customer''s payments when one is voided, restored, or re-dated — all
   three change which invoices the money covers.';

-- ============================================================================
-- 9. RPC: void a sale
-- ============================================================================
-- Cancel and hide, in one transaction. For a sale entered against the wrong
-- customer, where leaving a cancelled row on that customer's tab would itself be
-- wrong.
--
-- Not two client calls: the cancel half restores stock and frees the payments,
-- and a client that died between the two writes would leave a cancelled sale
-- still visible on the tab with no way to finish the job from the UI.

CREATE OR REPLACE FUNCTION public.void_sale(
  p_organization_id UUID,
  p_sale_id         UUID
)
RETURNS VOID AS $$
DECLARE
  v_sale sales;
BEGIN
  IF p_organization_id IS DISTINCT FROM public.current_organization_id() THEN
    RAISE EXCEPTION 'Sale not found.';
  END IF;

  SELECT * INTO v_sale
  FROM sales
  WHERE id = p_sale_id
    AND organization_id = p_organization_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found.';
  END IF;

  -- Stricter than editing: hiding a transaction is the one correction that leaves
  -- no trace on any screen. The action layer checks the same thing, and this is
  -- the backstop for a direct RPC call.
  IF NOT public.has_role_or_above('admin') THEN
    RAISE EXCEPTION 'You do not have permission to delete a transaction.';
  END IF;

  -- Already-cancelled sales skip the status write: the trigger has run, stock is
  -- back, and re-cancelling would be a no-op transition anyway.
  IF v_sale.status <> 'cancelled' THEN
    UPDATE sales SET status = 'cancelled' WHERE id = p_sale_id;
  END IF;

  UPDATE sales
  SET deleted_at = NOW(),
      updated_by = auth.uid()
  WHERE id = p_sale_id;

  -- Again after the soft delete. The cancel trigger reallocated while the row was
  -- still visible; this picks up anything that depended on it being gone.
  PERFORM public.fn_reallocate_customer_payments(v_sale.customer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.void_sale IS
  'Cancels a sale and hides it, in one transaction: stock goes back, the debt
   leaves the tab, and payments that were covering it become credit. Admin or
   above.';

-- ============================================================================
-- 10. ONE-OFF RECONCILIATION
-- ============================================================================
-- Any sale cancelled before this migration, and any payment edited or voided
-- through the old paths, left the artefacts described in sections 5 and 8. Replay
-- every customer once so the tab is correct from here on.

DO $$
DECLARE
  v_id UUID;
BEGIN
  FOR v_id IN SELECT id FROM customers WHERE deleted_at IS NULL LOOP
    PERFORM public.fn_reallocate_customer_payments(v_id);
  END LOOP;
END $$;
