-- ============================================================================
-- NON-SELLABLE STOCK, REORDER LEVELS, AND IMAGES
-- ============================================================================
-- Three related gaps, in one migration because they touch the same two tables.
--
-- 1. Stock that is not for sale. A shop holds carrier bags, tape, cleaning
--    supplies and packaging. They cost money, they run out, and running out stops
--    trade — so they need counting. They are not products: they have no sale
--    price, they must never appear in a sale line, and they must not show up in a
--    product picker or a revenue report.
--
--    Modelled as their own table rather than a flag on products, so the type
--    system and the foreign keys both enforce that a bag cannot be sold. The
--    alternative — products.is_sellable — would leave every future report one
--    forgotten WHERE clause away from counting bags as merchandise.
--
-- 2. reorder_level. src/features/inventory/queries.ts already selects
--    products.reorder_level in two column lists and filters on it in
--    lowStockQuery. The column has never existed, so every one of those queries
--    fails at runtime. Nothing has hit it yet only because InventoryService is
--    still a skeleton with no repository implementation, so it is never called.
--    Adding the column is what the application already believes is true.
--
-- 3. image_url. A picture is how someone recognises stock on a phone faster than
--    reading a SKU. Stored as a Storage object path, not a public URL — see
--    section 5.
--
-- The inventory table is the load-bearing change: product_id becomes nullable so
-- one row can point at either kind of thing. That table is on the
-- sale-completion deduction path, so section 3 is deliberately conservative
-- about what it changes.
-- ============================================================================

-- ============================================================================
-- 1. NEW COLUMNS ON PRODUCTS
-- ============================================================================

ALTER TABLE products
  ADD COLUMN image_url     TEXT,
  ADD COLUMN reorder_level DECIMAL(15, 3) CHECK (reorder_level IS NULL OR reorder_level >= 0);

COMMENT ON COLUMN products.image_url IS
  'Path to the object in the product-images Storage bucket, shaped
   <organization_id>/<product_id>.<ext> — not a URL. The bucket is private, so
   display goes through a signed URL and a stored absolute URL would expire.';
COMMENT ON COLUMN products.reorder_level IS
  'Warn when quantity_on_hand falls to or below this. NULL means no warning is
   configured for this product, which is different from 0 — 0 means "warn me only
   when it is actually gone".';

-- ============================================================================
-- 2. INVENTORY ITEMS
-- ============================================================================
-- Deliberately parallel to products in shape (code, name, category, unit, cost,
-- image, reorder level, soft delete) so the UI and repository layers can mirror
-- the product ones rather than inventing a second set of conventions.
--
-- What it does NOT have, and why:
--   * sale_price     — the entire point is that these are not sold.
--   * is_sellable    — implied by the table.
--   * cost_price is kept: it is what stock valuation is computed from, and
--     "how much money is sitting in packaging" is a real question.

CREATE TABLE inventory_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    item_code       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    category        TEXT,
    unit_of_measure TEXT DEFAULT 'unit',
    cost_price      DECIMAL(15, 2) NOT NULL DEFAULT 0,
    image_url       TEXT,
    reorder_level   DECIMAL(15, 3) CHECK (reorder_level IS NULL OR reorder_level >= 0),
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      UUID REFERENCES user_profiles(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE(organization_id, item_code)
);

CREATE INDEX idx_inventory_items_org        ON inventory_items(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_items_org_code   ON inventory_items(organization_id, item_code);
CREATE INDEX idx_inventory_items_org_active ON inventory_items(organization_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_items_name       ON inventory_items(organization_id, name) WHERE deleted_at IS NULL;

COMMENT ON TABLE inventory_items IS
  'Stock the business consumes rather than sells: bags, packaging, cleaning
   supplies. Counted like products, but can never appear on a sale line — there is
   no foreign key from sale_items to here, by design.';
COMMENT ON COLUMN inventory_items.cost_price IS
  'What the business paid per unit. Feeds stock valuation. There is no sale_price
   because these are never sold.';

CREATE TRIGGER trg_inventory_items_updated_at BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Codes follow the CUST-0001 / INV-2026-0001 house style, minus the year: unlike
-- invoices, there is no reason to restart the sequence annually.
CREATE OR REPLACE FUNCTION generate_inventory_item_code(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(item_code FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_num
  FROM inventory_items
  WHERE organization_id = org_id
    AND item_code ~ '^ITEM-[0-9]+$';

  RETURN 'ITEM-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_inventory_item_code IS
  'Generates the next item code: ITEM-0001, ITEM-0002. Scoped to organization. No
   year segment — these do not reset annually the way invoices do.';

-- ============================================================================
-- 3. INVENTORY HOLDS EITHER KIND
-- ============================================================================
-- product_id becomes nullable and item_id joins it, with a CHECK that exactly one
-- is set. num_nonnulls is the concise form of "one or the other, never both,
-- never neither".
--
-- The original UNIQUE(organization_id, product_id) has to go: it would let an
-- organization hold unlimited rows with product_id NULL, since Postgres treats
-- NULLs as distinct in a unique constraint. Two partial unique indexes replace
-- it, each stating the invariant for one kind — and they are what the
-- ON CONFLICT clauses in the auto-create triggers target.
--
-- Nothing on the sale path reads item_id, and every existing row keeps its
-- product_id, so the deduction trigger and the completion check are unaffected.

ALTER TABLE inventory
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE inventory
  ADD COLUMN item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE;

ALTER TABLE inventory
  DROP CONSTRAINT inventory_organization_id_product_id_key;

CREATE UNIQUE INDEX idx_inventory_one_row_per_product
  ON inventory(organization_id, product_id)
  WHERE product_id IS NOT NULL;

CREATE UNIQUE INDEX idx_inventory_one_row_per_item
  ON inventory(organization_id, item_id)
  WHERE item_id IS NOT NULL;

ALTER TABLE inventory
  ADD CONSTRAINT inventory_exactly_one_subject
  CHECK (num_nonnulls(product_id, item_id) = 1);

CREATE INDEX idx_inventory_item ON inventory(organization_id, item_id)
  WHERE item_id IS NOT NULL;

COMMENT ON COLUMN inventory.product_id IS
  'Set when this row counts a product. NULL when it counts an inventory_item.
   Exactly one of product_id / item_id is non-null — see
   inventory_exactly_one_subject.';
COMMENT ON COLUMN inventory.item_id IS
  'Set when this row counts a non-sellable inventory_item. NULL when it counts a
   product.';
COMMENT ON CONSTRAINT inventory_exactly_one_subject ON inventory IS
  'A stock row counts exactly one thing. Both set would double-count it in
   valuation; neither set would be a quantity of nothing.';

-- fn_create_inventory_for_product has to be redefined, not left alone. Its body
-- says ON CONFLICT (organization_id, product_id), which infers the constraint
-- that section 3 just dropped. Postgres resolves that inference at execution
-- time, so the function would still exist and still be called — and every single
-- product insert would fail with "no unique or exclusion constraint matching the
-- ON CONFLICT specification". Inferring a partial index requires restating its
-- predicate.
CREATE OR REPLACE FUNCTION fn_create_inventory_for_product()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO inventory (organization_id, product_id, item_id, quantity_on_hand)
  VALUES (NEW.organization_id, NEW.id, NULL, 0)
  ON CONFLICT (organization_id, product_id) WHERE product_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_create_inventory_for_product IS
  'Creates the inventory row for a new product at quantity 0, upholding the
   one-row-per-product invariant that stock queries and the sale-completion
   deduction both rely on. The ON CONFLICT predicate matches the partial unique
   index that replaced the original constraint in 20260803000001.';

-- The item equivalent, same invariant: every stock-tracked thing has exactly one
-- inventory row from the moment it is created, so no query has to cope with a
-- missing one.
CREATE OR REPLACE FUNCTION fn_create_inventory_for_item()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO inventory (organization_id, item_id, product_id, quantity_on_hand)
  VALUES (NEW.organization_id, NEW.id, NULL, 0)
  ON CONFLICT (organization_id, item_id) WHERE item_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_inventory_for_item
AFTER INSERT ON inventory_items
FOR EACH ROW
EXECUTE FUNCTION fn_create_inventory_for_item();

COMMENT ON FUNCTION fn_create_inventory_for_item IS
  'Creates the inventory row for a new item at quantity 0, mirroring
   fn_create_inventory_for_product and upholding the same
   one-row-per-tracked-thing invariant.';

-- ============================================================================
-- 4. ROW LEVEL SECURITY FOR INVENTORY ITEMS
-- ============================================================================
-- Mirrors the products policies exactly: everyone in the org can see what stock
-- exists, managers and above can change the catalogue. Written as three explicit
-- policies rather than one FOR ALL, following the note in
-- 000003_row_level_security.sql about permissive policies being OR'd.
--
-- No DELETE policy, matching products: removal is a soft delete, which is an
-- UPDATE of deleted_at.

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_items_select_same_org"
ON inventory_items FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

CREATE POLICY "inventory_items_insert_manager_or_above"
ON inventory_items FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

CREATE POLICY "inventory_items_update_manager_or_above"
ON inventory_items FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- ============================================================================
-- 5. STORAGE BUCKET FOR IMAGES
-- ============================================================================
-- Private, not public. A product catalogue with cost prices attached is
-- commercially sensitive, and a public bucket means any object path is guessable
-- and permanently readable by anyone. Display therefore goes through a signed
-- URL created server-side, which is also why image_url stores a path rather than
-- an absolute URL — a stored signed URL would expire.
--
-- Tenancy is enforced by path: the first segment must be the caller's
-- organization_id. storage.foldername() splits the object name on '/', so
-- [1] is that first segment. This is the standard Supabase pattern for
-- per-tenant buckets, and it means a member of org A cannot read, write or
-- overwrite an object under org B's prefix even knowing its exact path.
--
-- One bucket for both products and items: they are the same kind of object with
-- the same access rules, and a second bucket would mean a second set of four
-- near-identical policies to keep in step.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  FALSE,
  5242880,  -- 5 MB: a phone photo, not a print asset. Rejected at the API edge.
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- SELECT is org-wide rather than manager-only, matching
-- inventory_select_same_org: an employee checking stock on a phone needs to see
-- the picture. Writes are manager-and-above, matching who may edit the catalogue.

CREATE POLICY "product_images_select_same_org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
);

CREATE POLICY "product_images_insert_manager_or_above"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('manager')
);

-- Replacing a picture is an overwrite of the same path, so update needs the same
-- check on both sides.
CREATE POLICY "product_images_update_manager_or_above"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('manager')
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('manager')
);

CREATE POLICY "product_images_delete_manager_or_above"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('manager')
);

-- ============================================================================
-- 6. BACKFILL
-- ============================================================================
-- Products created before this migration have no inventory row only if
-- trg_create_inventory_for_product was added after them. It was created in
-- 000004, after 000001's table, so any product inserted between those two
-- migrations is missing one. Cheap to make certain of, and a missing row would
-- read as "no stock record" everywhere in the new inventory UI.

INSERT INTO inventory (organization_id, product_id, item_id, quantity_on_hand)
SELECT p.organization_id, p.id, NULL, 0
FROM products p
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM inventory i
    WHERE i.product_id = p.id
      AND i.organization_id = p.organization_id
  )
ON CONFLICT DO NOTHING;
