-- ============================================================================
-- RLS INITPLAN OPTIMIZATION
-- ============================================================================
-- Recreates all 40 policies with their helper calls wrapped in scalar
-- subqueries. No policy logic changes. Every USING and WITH CHECK expression
-- below is semantically identical to the one it replaces — only the wrapping
-- differs.
--
-- THE PROBLEM
--
-- Written bare, `organization_id = public.current_organization_id()` is a
-- qualification Postgres applies per row. current_organization_id() is STABLE,
-- so the planner is permitted to evaluate it once — but inside an RLS policy
-- expression it frequently does not, and the function body itself contains a
-- COALESCE over a subquery against user_profiles. On a sequential scan of a
-- table with N rows that is N calls, and each call may hit user_profiles.
--
-- THE FIX
--
-- `(select public.current_organization_id())` is a scalar subquery with no
-- correlation to the outer row, so Postgres hoists it into an InitPlan and
-- evaluates it exactly once per query execution, caching the result. This is
-- the optimization Supabase documents for exactly this pattern.
--
-- WHY IT IS SAFE
--
-- All three helpers are STABLE SECURITY DEFINER, meaning they are guaranteed
-- not to change within a single statement. Caching a value that cannot change
-- is not a behaviour change. auth.uid() is likewise stable within a statement.
-- A user who could not see a row before still cannot see it now.
--
-- WHAT THIS DOES NOT FIX
--
-- The is_active gap documented on current_organization_id() is untouched. A
-- deactivated employee holding an unexpired token still passes RLS. That is a
-- separate change requiring session revocation on deactivation, and it is
-- deliberately not bundled into a performance migration.
--
-- DROP then CREATE rather than ALTER: Postgres has no ALTER POLICY that can
-- rewrite USING and WITH CHECK together atomically in one readable statement,
-- and IF EXISTS keeps this migration idempotent.
-- ============================================================================

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================
DROP POLICY IF EXISTS "org_select_own" ON organizations;

CREATE POLICY "org_select_own"
ON organizations FOR SELECT TO authenticated
USING (id = (select public.current_organization_id()));

DROP POLICY IF EXISTS "org_update_owner_only" ON organizations;

CREATE POLICY "org_update_owner_only"
ON organizations FOR UPDATE TO authenticated
USING      (id = (select public.current_organization_id()) AND (select public.current_user_role()) = 'owner')
WITH CHECK (id = (select public.current_organization_id()) AND (select public.current_user_role()) = 'owner');

-- ============================================================================
-- USER PROFILES
-- ============================================================================
DROP POLICY IF EXISTS "profiles_select_same_org" ON user_profiles;

CREATE POLICY "profiles_select_same_org"
ON user_profiles FOR SELECT TO authenticated
USING (organization_id = (select public.current_organization_id()));

DROP POLICY IF EXISTS "profiles_insert_admin_or_above" ON user_profiles;

CREATE POLICY "profiles_insert_admin_or_above"
ON user_profiles FOR INSERT TO authenticated
WITH CHECK (
  organization_id = (select public.current_organization_id())
  AND (select public.has_role_or_above('admin'))
);

DROP POLICY IF EXISTS "profiles_update_admin_or_above" ON user_profiles;

CREATE POLICY "profiles_update_admin_or_above"
ON user_profiles FOR UPDATE TO authenticated
USING      (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('admin')))
WITH CHECK (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('admin')));

-- ============================================================================
-- CUSTOMERS
-- ============================================================================
DROP POLICY IF EXISTS "customers_select_same_org" ON customers;

CREATE POLICY "customers_select_same_org"
ON customers FOR SELECT TO authenticated
USING (organization_id = (select public.current_organization_id()));

DROP POLICY IF EXISTS "customers_insert_any_role" ON customers;

CREATE POLICY "customers_insert_any_role"
ON customers FOR INSERT TO authenticated
WITH CHECK (organization_id = (select public.current_organization_id()));

DROP POLICY IF EXISTS "customers_update_manager_or_above" ON customers;

CREATE POLICY "customers_update_manager_or_above"
ON customers FOR UPDATE TO authenticated
USING      (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('manager')))
WITH CHECK (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('manager')));

-- ============================================================================
-- PRODUCTS
-- ============================================================================
DROP POLICY IF EXISTS "products_select_same_org" ON products;

CREATE POLICY "products_select_same_org"
ON products FOR SELECT TO authenticated
USING (organization_id = (select public.current_organization_id()));

DROP POLICY IF EXISTS "products_insert_manager_or_above" ON products;

CREATE POLICY "products_insert_manager_or_above"
ON products FOR INSERT TO authenticated
WITH CHECK (
  organization_id = (select public.current_organization_id())
  AND (select public.has_role_or_above('manager'))
);

DROP POLICY IF EXISTS "products_update_manager_or_above" ON products;

CREATE POLICY "products_update_manager_or_above"
ON products FOR UPDATE TO authenticated
USING      (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('manager')))
WITH CHECK (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('manager')));

-- ============================================================================
-- INVENTORY
-- ============================================================================
DROP POLICY IF EXISTS "inventory_select_same_org" ON inventory;

CREATE POLICY "inventory_select_same_org"
ON inventory FOR SELECT TO authenticated
USING (organization_id = (select public.current_organization_id()));

DROP POLICY IF EXISTS "inventory_insert_manager_or_above" ON inventory;

CREATE POLICY "inventory_insert_manager_or_above"
ON inventory FOR INSERT TO authenticated
WITH CHECK (
  organization_id = (select public.current_organization_id())
  AND (select public.has_role_or_above('manager'))
);

DROP POLICY IF EXISTS "inventory_update_manager_or_above" ON inventory;

CREATE POLICY "inventory_update_manager_or_above"
ON inventory FOR UPDATE TO authenticated
USING      (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('manager')))
WITH CHECK (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('manager')));

-- ============================================================================
-- SALES
-- ============================================================================
DROP POLICY IF EXISTS "sales_select_same_org" ON sales;

CREATE POLICY "sales_select_same_org"
ON sales FOR SELECT TO authenticated
USING (organization_id = (select public.current_organization_id()));

DROP POLICY IF EXISTS "sales_insert_any_role" ON sales;

CREATE POLICY "sales_insert_any_role"
ON sales FOR INSERT TO authenticated
WITH CHECK (organization_id = (select public.current_organization_id()));

-- created_by = (select auth.uid()) stays a per-row comparison, as it must: the
-- left side is the row's own column. Only the auth.uid() call is hoisted.
DROP POLICY IF EXISTS "sales_update_scoped_by_role" ON sales;

CREATE POLICY "sales_update_scoped_by_role"
ON sales FOR UPDATE TO authenticated
USING (
  organization_id = (select public.current_organization_id())
  AND ((select public.has_role_or_above('manager')) OR created_by = (select auth.uid()))
)
WITH CHECK (
  organization_id = (select public.current_organization_id())
  AND ((select public.has_role_or_above('manager')) OR created_by = (select auth.uid()))
);

-- ============================================================================
-- SALE ITEMS
-- ============================================================================
-- The EXISTS stays correlated — it joins on sale_items.sale_id, so it is
-- re-executed per row by design. The helper calls inside it are not correlated
-- to anything, so they hoist to InitPlans at the top level and run once for the
-- whole statement rather than once per candidate row.
DROP POLICY IF EXISTS "sale_items_select_same_org" ON sale_items;

CREATE POLICY "sale_items_select_same_org"
ON sale_items FOR SELECT TO authenticated
USING (organization_id = (select public.current_organization_id()));

DROP POLICY IF EXISTS "sale_items_insert_follows_sale" ON sale_items;

CREATE POLICY "sale_items_insert_follows_sale"
ON sale_items FOR INSERT TO authenticated
WITH CHECK (
  organization_id = (select public.current_organization_id())
  AND EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = sale_items.sale_id
      AND s.organization_id = (select public.current_organization_id())
      AND ((select public.has_role_or_above('manager')) OR s.created_by = (select auth.uid()))
  )
);

DROP POLICY IF EXISTS "sale_items_update_follows_sale" ON sale_items;

CREATE POLICY "sale_items_update_follows_sale"
ON sale_items FOR UPDATE TO authenticated
USING (
  organization_id = (select public.current_organization_id())
  AND EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = sale_items.sale_id
      AND s.organization_id = (select public.current_organization_id())
      AND ((select public.has_role_or_above('manager')) OR s.created_by = (select auth.uid()))
  )
)
WITH CHECK (
  organization_id = (select public.current_organization_id())
  AND EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = sale_items.sale_id
      AND s.organization_id = (select public.current_organization_id())
      AND ((select public.has_role_or_above('manager')) OR s.created_by = (select auth.uid()))
  )
);

DROP POLICY IF EXISTS "sale_items_delete_follows_sale" ON sale_items;

CREATE POLICY "sale_items_delete_follows_sale"
ON sale_items FOR DELETE TO authenticated
USING (
  organization_id = (select public.current_organization_id())
  AND EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = sale_items.sale_id
      AND s.organization_id = (select public.current_organization_id())
      AND ((select public.has_role_or_above('manager')) OR s.created_by = (select auth.uid()))
  )
);

-- ============================================================================
-- PAYMENTS
-- ============================================================================
DROP POLICY IF EXISTS "payments_select_same_org" ON payments;

CREATE POLICY "payments_select_same_org"
ON payments FOR SELECT TO authenticated
USING (organization_id = (select public.current_organization_id()));

DROP POLICY IF EXISTS "payments_insert_any_role" ON payments;

CREATE POLICY "payments_insert_any_role"
ON payments FOR INSERT TO authenticated
WITH CHECK (organization_id = (select public.current_organization_id()));

DROP POLICY IF EXISTS "payments_update_manager_or_above" ON payments;

CREATE POLICY "payments_update_manager_or_above"
ON payments FOR UPDATE TO authenticated
USING      (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('manager')))
WITH CHECK (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('manager')));

-- ============================================================================
-- PAYMENT ALLOCATIONS
-- ============================================================================
DROP POLICY IF EXISTS "payment_allocations_select_same_org" ON payment_allocations;

CREATE POLICY "payment_allocations_select_same_org"
ON payment_allocations FOR SELECT TO authenticated
USING (organization_id = (select public.current_organization_id()));

DROP POLICY IF EXISTS "payment_allocations_insert_any_role" ON payment_allocations;

CREATE POLICY "payment_allocations_insert_any_role"
ON payment_allocations FOR INSERT TO authenticated
WITH CHECK (organization_id = (select public.current_organization_id()));

DROP POLICY IF EXISTS "payment_allocations_update_manager_or_above" ON payment_allocations;

CREATE POLICY "payment_allocations_update_manager_or_above"
ON payment_allocations FOR UPDATE TO authenticated
USING      (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('manager')))
WITH CHECK (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('manager')));

DROP POLICY IF EXISTS "payment_allocations_delete_manager_or_above" ON payment_allocations;

CREATE POLICY "payment_allocations_delete_manager_or_above"
ON payment_allocations FOR DELETE TO authenticated
USING (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('manager')));

-- ============================================================================
-- EXPENSES
-- ============================================================================
DROP POLICY IF EXISTS "expenses_select_same_org" ON expenses;

CREATE POLICY "expenses_select_same_org"
ON expenses FOR SELECT TO authenticated
USING (organization_id = (select public.current_organization_id()));

DROP POLICY IF EXISTS "expenses_insert_any_role" ON expenses;

CREATE POLICY "expenses_insert_any_role"
ON expenses FOR INSERT TO authenticated
WITH CHECK (organization_id = (select public.current_organization_id()));

DROP POLICY IF EXISTS "expenses_update_manager_or_above" ON expenses;

CREATE POLICY "expenses_update_manager_or_above"
ON expenses FOR UPDATE TO authenticated
USING      (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('manager')))
WITH CHECK (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('manager')));

-- ============================================================================
-- INVENTORY ITEMS
-- ============================================================================
DROP POLICY IF EXISTS "inventory_items_select_same_org" ON inventory_items;

CREATE POLICY "inventory_items_select_same_org"
ON inventory_items FOR SELECT TO authenticated
USING (organization_id = (select public.current_organization_id()));

DROP POLICY IF EXISTS "inventory_items_insert_manager_or_above" ON inventory_items;

CREATE POLICY "inventory_items_insert_manager_or_above"
ON inventory_items FOR INSERT TO authenticated
WITH CHECK (
  organization_id = (select public.current_organization_id())
  AND (select public.has_role_or_above('manager'))
);

DROP POLICY IF EXISTS "inventory_items_update_manager_or_above" ON inventory_items;

CREATE POLICY "inventory_items_update_manager_or_above"
ON inventory_items FOR UPDATE TO authenticated
USING      (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('manager')))
WITH CHECK (organization_id = (select public.current_organization_id()) AND (select public.has_role_or_above('manager')));

-- ============================================================================
-- INVENTORY ADJUSTMENTS
-- ============================================================================
DROP POLICY IF EXISTS "inventory_adjustments_select_same_org" ON inventory_adjustments;

CREATE POLICY "inventory_adjustments_select_same_org"
ON inventory_adjustments FOR SELECT TO authenticated
USING (organization_id = (select public.current_organization_id()));

DROP POLICY IF EXISTS "inventory_adjustments_insert_manager_or_above" ON inventory_adjustments;

CREATE POLICY "inventory_adjustments_insert_manager_or_above"
ON inventory_adjustments FOR INSERT TO authenticated
WITH CHECK (
  organization_id = (select public.current_organization_id())
  AND (select public.has_role_or_above('manager'))
);

-- ============================================================================
-- PRODUCT IMAGES (storage.objects)
-- ============================================================================
-- These four sit on storage.objects, which the migration role does not own on
-- hosted Supabase. The original migration created them, so dropping and
-- recreating them should succeed the same way — but if this migration fails, it
-- will fail here and not before. Every policy above is already committed at that
-- point, and re-running is safe because of IF EXISTS.
--
-- (storage.foldername(name))[1] stays per-row: it reads the row's own name
-- column. Only the org lookup and role check hoist.
DROP POLICY IF EXISTS "product_images_select_same_org" ON storage.objects;

CREATE POLICY "product_images_select_same_org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = (select public.current_organization_id())::TEXT
);

DROP POLICY IF EXISTS "product_images_insert_manager_or_above" ON storage.objects;

CREATE POLICY "product_images_insert_manager_or_above"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = (select public.current_organization_id())::TEXT
  AND (select public.has_role_or_above('manager'))
);

DROP POLICY IF EXISTS "product_images_update_manager_or_above" ON storage.objects;

CREATE POLICY "product_images_update_manager_or_above"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = (select public.current_organization_id())::TEXT
  AND (select public.has_role_or_above('manager'))
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = (select public.current_organization_id())::TEXT
  AND (select public.has_role_or_above('manager'))
);

DROP POLICY IF EXISTS "product_images_delete_manager_or_above" ON storage.objects;

CREATE POLICY "product_images_delete_manager_or_above"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = (select public.current_organization_id())::TEXT
  AND (select public.has_role_or_above('manager'))
);
