-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Tenant isolation. Every policy is scoped to the `authenticated` role, so an
-- anonymous request is rejected by the role check before any expression runs.
--
-- Two things RLS here does NOT do, both deliberate:
--
-- 1. It does not filter soft-deleted rows. deleted_at filtering is a query
--    concern, not a security one, and belongs in the repository layer. Putting
--    it in policies would make it impossible to build an "undo delete" screen.
--
-- 2. There are no INSERT policies on organizations and no DELETE policies
--    anywhere except sale_items. Organization creation runs through the
--    service-role client during onboarding, because a brand-new user has no
--    organization and therefore cannot satisfy any tenant-scoped policy.
--    Hard deletes are not part of the product: everything user-facing is a soft
--    delete, so the absence of a DELETE policy is the enforcement.
--
-- On UPDATE policies: Postgres applies USING to the existing row and WITH CHECK
-- to the updated row, falling back to USING when WITH CHECK is omitted. Both are
-- written out explicitly below. It is the same behaviour, stated once so nobody
-- has to remember the defaulting rule to audit a policy.
-- ============================================================================

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select_own"
ON organizations FOR SELECT TO authenticated
USING (id = public.current_organization_id());

CREATE POLICY "org_update_owner_only"
ON organizations FOR UPDATE TO authenticated
USING      (id = public.current_organization_id() AND public.current_user_role() = 'owner')
WITH CHECK (id = public.current_organization_id() AND public.current_user_role() = 'owner');

-- ============================================================================
-- USER PROFILES
-- ============================================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_same_org"
ON user_profiles FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- Covers inviting a team member. The first profile in an organization is created
-- by the service role during onboarding, since the inviting user does not exist
-- yet at that point.
CREATE POLICY "profiles_insert_admin_or_above"
ON user_profiles FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('admin')
);

CREATE POLICY "profiles_update_admin_or_above"
ON user_profiles FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('admin'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('admin'));

-- ============================================================================
-- CUSTOMERS
-- ============================================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select_same_org"
ON customers FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- Any role can add a customer: an employee taking an order for a new shop should
-- not have to wait for a manager.
CREATE POLICY "customers_insert_any_role"
ON customers FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_organization_id());

CREATE POLICY "customers_update_manager_or_above"
ON customers FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- ============================================================================
-- PRODUCTS
-- ============================================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_same_org"
ON products FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

CREATE POLICY "products_insert_manager_or_above"
ON products FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

CREATE POLICY "products_update_manager_or_above"
ON products FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- ============================================================================
-- INVENTORY
-- ============================================================================
-- Written as three explicit policies rather than one FOR ALL. The previous
-- version had a manager-scoped FOR ALL sitting alongside an everyone-scoped
-- SELECT, which worked only because permissive policies are OR'd together —
-- readable only if you already know that rule.
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Everyone can see stock levels: an employee needs to know whether there are
-- boxes of biscuits left before promising them to a customer.
CREATE POLICY "inventory_select_same_org"
ON inventory FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

CREATE POLICY "inventory_insert_manager_or_above"
ON inventory FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

CREATE POLICY "inventory_update_manager_or_above"
ON inventory FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- ============================================================================
-- SALES
-- ============================================================================
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_select_same_org"
ON sales FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

CREATE POLICY "sales_insert_any_role"
ON sales FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_organization_id());

-- Managers and above can edit any sale. An employee can only edit one they
-- created, so a delivery driver cannot quietly alter someone else's invoice.
CREATE POLICY "sales_update_scoped_by_role"
ON sales FOR UPDATE TO authenticated
USING (
  organization_id = public.current_organization_id()
  AND (public.has_role_or_above('manager') OR created_by = auth.uid())
)
WITH CHECK (
  organization_id = public.current_organization_id()
  AND (public.has_role_or_above('manager') OR created_by = auth.uid())
);

-- ============================================================================
-- SALE ITEMS
-- ============================================================================
-- The one table with a DELETE policy. Removing a line item from a draft is a
-- genuine hard delete — a soft-deleted line item would still have to be excluded
-- from the totals trigger, and an invoice that silently carries invisible rows is
-- worse than one that carries none.
--
-- Write access follows the parent sale rather than being re-derived here: the
-- same person who may edit a sale may edit its lines. Checking created_by on the
-- parent (not on sale_items, which has no such column) keeps the two rules from
-- drifting apart.
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_items_select_same_org"
ON sale_items FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

CREATE POLICY "sale_items_insert_follows_sale"
ON sale_items FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = sale_items.sale_id
      AND s.organization_id = public.current_organization_id()
      AND (public.has_role_or_above('manager') OR s.created_by = auth.uid())
  )
);

CREATE POLICY "sale_items_update_follows_sale"
ON sale_items FOR UPDATE TO authenticated
USING (
  organization_id = public.current_organization_id()
  AND EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = sale_items.sale_id
      AND s.organization_id = public.current_organization_id()
      AND (public.has_role_or_above('manager') OR s.created_by = auth.uid())
  )
)
WITH CHECK (
  organization_id = public.current_organization_id()
  AND EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = sale_items.sale_id
      AND s.organization_id = public.current_organization_id()
      AND (public.has_role_or_above('manager') OR s.created_by = auth.uid())
  )
);

CREATE POLICY "sale_items_delete_follows_sale"
ON sale_items FOR DELETE TO authenticated
USING (
  organization_id = public.current_organization_id()
  AND EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = sale_items.sale_id
      AND s.organization_id = public.current_organization_id()
      AND (public.has_role_or_above('manager') OR s.created_by = auth.uid())
  )
);

-- ============================================================================
-- PAYMENTS
-- ============================================================================
-- Any role can record a payment: the person who collects the cash is usually the
-- one standing in front of the customer, and making them wait for a manager is
-- how payments end up written on paper instead.
--
-- Editing one is manager-and-above, because a payment amount feeds
-- customer.current_balance through a trigger. An employee who could rewrite an
-- amount could quietly erase a debt.
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select_same_org"
ON payments FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

CREATE POLICY "payments_insert_any_role"
ON payments FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_organization_id());

CREATE POLICY "payments_update_manager_or_above"
ON payments FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- ============================================================================
-- EXPENSES
-- ============================================================================
-- Same shape as payments, for the same reason: an employee who buys packing tape
-- should be able to log it, but only a manager can change what was logged.
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select_same_org"
ON expenses FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

CREATE POLICY "expenses_insert_any_role"
ON expenses FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_organization_id());

CREATE POLICY "expenses_update_manager_or_above"
ON expenses FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));
