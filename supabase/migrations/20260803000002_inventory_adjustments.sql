-- ============================================================================
-- INVENTORY ADJUSTMENT LOG
-- ============================================================================
-- Stock moves for two kinds of reason. Sales move it automatically, and those are
-- already explained by the sale itself — the invoice says where the goods went.
-- Everything else is a human saying "the number is wrong, here is the truth":
-- opening stock, a delivery from a supplier, a damaged box, a physical recount.
--
-- Without a log, those are indistinguishable after the fact. The count says 38,
-- it said 40 last week, and nobody can say whether two were sold, dropped, or
-- miscounted. That question is the whole reason to track stock, so the answer
-- needs a table.
--
-- src/features/inventory/types.ts already models this as InventoryAdjustment and
-- calls it "a domain object (not directly a DB table in MVP)", and the service
-- already calls repo.recordAdjustment after every adjustment. This makes the
-- promise real rather than deleting the call.
--
-- Design notes:
--   * Append-only. An adjustment is a historical claim about a moment; correcting
--     one means recording another, the same way a ledger works. No UPDATE policy.
--   * quantity_delta is signed, and quantity_after is stored alongside it. The
--     delta alone would force every reader to replay the whole history to know
--     what the shelf held at that point, and a replay disagreeing with today's
--     count could not be localised to a row.
--   * reason is TEXT with a CHECK, not an ENUM, matching the comment in types.ts
--     about adding reasons without a migration. A CHECK is one ALTER to widen;
--     an ENUM value cannot be removed at all.
-- ============================================================================

CREATE TABLE inventory_adjustments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Mirrors the inventory table: an adjustment is about a product or an item,
    -- exactly one. Same reasoning, same CHECK.
    product_id      UUID REFERENCES products(id)         ON DELETE CASCADE,
    item_id         UUID REFERENCES inventory_items(id)  ON DELETE CASCADE,

    quantity_delta  DECIMAL(15, 3) NOT NULL CHECK (quantity_delta <> 0),
    quantity_after  DECIMAL(15, 3) NOT NULL CHECK (quantity_after >= 0),

    reason          TEXT NOT NULL CHECK (reason IN (
                      'initial_stock',
                      'purchase',
                      'return',
                      'damage',
                      'loss',
                      'count_correction',
                      'other'
                    )),
    notes           TEXT,

    adjusted_by     UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    adjusted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT inventory_adjustments_exactly_one_subject
      CHECK (num_nonnulls(product_id, item_id) = 1)
);

-- The common read is "this thing's history, newest first".
CREATE INDEX idx_inv_adjustments_product ON inventory_adjustments(organization_id, product_id, adjusted_at DESC)
  WHERE product_id IS NOT NULL;
CREATE INDEX idx_inv_adjustments_item    ON inventory_adjustments(organization_id, item_id, adjusted_at DESC)
  WHERE item_id IS NOT NULL;
CREATE INDEX idx_inv_adjustments_org     ON inventory_adjustments(organization_id, adjusted_at DESC);

COMMENT ON TABLE inventory_adjustments IS
  'Append-only log of manual stock changes. Sale-driven movements are not recorded
   here — the sale is their explanation. This covers deliveries, damage, losses and
   recounts, so a disagreeing count can be traced to who changed what and why.';
COMMENT ON COLUMN inventory_adjustments.quantity_delta IS
  'Signed. Positive is stock arriving, negative is stock leaving. Never zero — a
   no-op adjustment is not an event.';
COMMENT ON COLUMN inventory_adjustments.quantity_after IS
  'What the shelf held once this was applied. Stored rather than derived so
   history can be read without replaying every prior row.';
COMMENT ON COLUMN inventory_adjustments.reason IS
  'CHECK rather than an ENUM: widening the list is one ALTER, whereas an ENUM
   value can never be removed. Mirrors InventoryAdjustmentReason in types.ts.';

-- ============================================================================
-- RLS
-- ============================================================================
-- Readable org-wide, like inventory itself: knowing why the count changed is part
-- of knowing the count. Written by managers and above, matching who may adjust.
--
-- No UPDATE or DELETE policy, deliberately. The table is append-only, and a log
-- that can be quietly rewritten answers no questions.

ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_adjustments_select_same_org"
ON inventory_adjustments FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

CREATE POLICY "inventory_adjustments_insert_manager_or_above"
ON inventory_adjustments FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

-- ============================================================================
-- RPC: adjust stock and log it, atomically
-- ============================================================================
-- One call rather than an UPDATE followed by an INSERT from the client. The
-- service currently does exactly that split — repo.adjust() then
-- repo.recordAdjustment() — which means a failure in between moves stock and
-- loses the reason, producing the one thing the log exists to prevent: a number
-- that changed with no explanation.
--
-- Also the only correct place for the read-modify-write. Computing the new
-- quantity in the application means two concurrent adjustments can both read 40,
-- both write their own delta against it, and lose one. FOR UPDATE on the
-- inventory row serialises them.

CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_organization_id UUID,
  p_product_id      UUID,
  p_item_id         UUID,
  p_delta           DECIMAL(15,3),
  p_reason          TEXT,
  p_notes           TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_inventory inventory;
  v_after     DECIMAL(15,3);
  v_label     TEXT;
  v_id        UUID;
BEGIN
  IF p_organization_id IS DISTINCT FROM public.current_organization_id() THEN
    RAISE EXCEPTION 'Not authorized for this organization.';
  END IF;

  IF NOT public.has_role_or_above('manager') THEN
    RAISE EXCEPTION 'You do not have permission to adjust stock.';
  END IF;

  IF num_nonnulls(p_product_id, p_item_id) <> 1 THEN
    RAISE EXCEPTION 'An adjustment is about exactly one product or one item.';
  END IF;

  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'Adjustment quantity cannot be zero.';
  END IF;

  -- Locked before the arithmetic, so a second adjustment on the same shelf waits
  -- rather than computing against a figure that is about to change.
  SELECT * INTO v_inventory
  FROM inventory
  WHERE organization_id = p_organization_id
    AND (
      (p_product_id IS NOT NULL AND product_id = p_product_id)
      OR (p_item_id IS NOT NULL AND item_id = p_item_id)
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No stock record found for that product or item.';
  END IF;

  v_after := COALESCE(v_inventory.quantity_on_hand, 0) + p_delta;

  -- Named before the CHECK (quantity_on_hand >= 0) constraint would fire, so the
  -- message can say what is actually on the shelf. Mirrors how the sale-completion
  -- deduction reports a shortage.
  IF v_after < 0 THEN
    IF p_product_id IS NOT NULL THEN
      SELECT name INTO v_label FROM products WHERE id = p_product_id;
    ELSE
      SELECT name INTO v_label FROM inventory_items WHERE id = p_item_id;
    END IF;

    RAISE EXCEPTION
      'Not enough stock to remove % from "%": only % on hand.',
      ABS(p_delta), COALESCE(v_label, 'that item'), COALESCE(v_inventory.quantity_on_hand, 0);
  END IF;

  UPDATE inventory
  SET quantity_on_hand = v_after,
      updated_at       = NOW()
  WHERE id = v_inventory.id;

  INSERT INTO inventory_adjustments (
    organization_id, product_id, item_id,
    quantity_delta, quantity_after, reason, notes, adjusted_by
  ) VALUES (
    p_organization_id, p_product_id, p_item_id,
    p_delta, v_after, p_reason, NULLIF(TRIM(COALESCE(p_notes, '')), ''), auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.adjust_inventory IS
  'Moves stock by a signed delta and records why, in one transaction. Locks the
   inventory row so concurrent adjustments cannot lose one another. Manager or
   above. Returns the adjustment id.';

-- ============================================================================
-- RPC: set stock to a counted figure
-- ============================================================================
-- What a physical recount produces is an absolute number, not a delta. Computing
-- the delta client-side means reading the current quantity in one request and
-- writing in another — and anything that happens in between is silently
-- overwritten. Deriving it inside the same lock is the difference between
-- "correct to 38" and "clobber whatever it is now with 38".

CREATE OR REPLACE FUNCTION public.set_inventory_count(
  p_organization_id UUID,
  p_product_id      UUID,
  p_item_id         UUID,
  p_counted         DECIMAL(15,3),
  p_notes           TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_current DECIMAL(15,3);
  v_delta   DECIMAL(15,3);
BEGIN
  -- Repeated here rather than left to adjust_inventory. This function is
  -- SECURITY DEFINER, so RLS does not apply inside it, and its SELECT below would
  -- otherwise read another organization's quantity before the delegated call
  -- rejected the request.
  IF p_organization_id IS DISTINCT FROM public.current_organization_id() THEN
    RAISE EXCEPTION 'Not authorized for this organization.';
  END IF;

  IF NOT public.has_role_or_above('manager') THEN
    RAISE EXCEPTION 'You do not have permission to adjust stock.';
  END IF;

  IF p_counted IS NULL OR p_counted < 0 THEN
    RAISE EXCEPTION 'A counted quantity cannot be negative.';
  END IF;

  IF num_nonnulls(p_product_id, p_item_id) <> 1 THEN
    RAISE EXCEPTION 'An adjustment is about exactly one product or one item.';
  END IF;

  -- Same lock as adjust_inventory, taken here so the delta is computed from the
  -- figure that adjust_inventory will then apply it to.
  SELECT COALESCE(quantity_on_hand, 0) INTO v_current
  FROM inventory
  WHERE organization_id = p_organization_id
    AND (
      (p_product_id IS NOT NULL AND product_id = p_product_id)
      OR (p_item_id IS NOT NULL AND item_id = p_item_id)
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No stock record found for that product or item.';
  END IF;

  v_delta := p_counted - v_current;

  IF v_delta = 0 THEN
    RAISE EXCEPTION 'The count already matches what is recorded. Nothing to correct.';
  END IF;

  RETURN public.adjust_inventory(
    p_organization_id, p_product_id, p_item_id, v_delta, 'count_correction', p_notes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.set_inventory_count IS
  'Corrects stock to a counted figure, deriving the delta under the same row lock
   that applies it so nothing between the read and the write is lost. Logged as
   count_correction. Manager or above.';
