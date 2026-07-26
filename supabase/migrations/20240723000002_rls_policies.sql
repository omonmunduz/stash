-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - MVP
-- ============================================================================

-- Helper function to get current user's organization_id from JWT
CREATE OR REPLACE FUNCTION auth.organization_id()
RETURNS UUID AS $$
  SELECT organization_id FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

COMMENT ON FUNCTION auth.organization_id IS 'Returns the organization_id for the currently authenticated user';

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

COMMENT ON FUNCTION auth.user_role IS 'Returns the role for the currently authenticated user';

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own organization
CREATE POLICY "Users can view their organization"
ON organizations FOR SELECT
USING (id = auth.organization_id());

-- Only owners can update organization settings
CREATE POLICY "Owners can update their organization"
ON organizations FOR UPDATE
USING (id = auth.organization_id() AND auth.user_role() = 'owner');

-- ============================================================================
-- USER PROFILES
-- ============================================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view profiles in their organization
CREATE POLICY "Users can view profiles in their organization"
ON user_profiles FOR SELECT
USING (organization_id = auth.organization_id());

-- Owners and admins can insert new users
CREATE POLICY "Owners and admins can create users"
ON user_profiles FOR INSERT
WITH CHECK (
  organization_id = auth.organization_id()
  AND auth.user_role() IN ('owner', 'admin')
);

-- Owners and admins can update users
CREATE POLICY "Owners and admins can update users"
ON user_profiles FOR UPDATE
USING (
  organization_id = auth.organization_id()
  AND auth.user_role() IN ('owner', 'admin')
);

-- ============================================================================
-- CUSTOMERS
-- ============================================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- All users can view customers in their organization
CREATE POLICY "Users can view customers in their organization"
ON customers FOR SELECT
USING (organization_id = auth.organization_id());

-- All users can create customers
CREATE POLICY "Users can create customers"
ON customers FOR INSERT
WITH CHECK (organization_id = auth.organization_id());

-- Managers and above can update customers
CREATE POLICY "Managers and above can update customers"
ON customers FOR UPDATE
USING (
  organization_id = auth.organization_id()
  AND auth.user_role() IN ('owner', 'admin', 'manager')
);

-- ============================================================================
-- PRODUCTS
-- ============================================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- All users can view products
CREATE POLICY "Users can view products in their organization"
ON products FOR SELECT
USING (organization_id = auth.organization_id());

-- Managers and above can create products
CREATE POLICY "Managers and above can create products"
ON products FOR INSERT
WITH CHECK (
  organization_id = auth.organization_id()
  AND auth.user_role() IN ('owner', 'admin', 'manager')
);

-- Managers and above can update products
CREATE POLICY "Managers and above can update products"
ON products FOR UPDATE
USING (
  organization_id = auth.organization_id()
  AND auth.user_role() IN ('owner', 'admin', 'manager')
);

-- ============================================================================
-- INVENTORY
-- ============================================================================
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- All users can view inventory
CREATE POLICY "Users can view inventory in their organization"
ON inventory FOR SELECT
USING (organization_id = auth.organization_id());

-- Managers and above can update inventory
CREATE POLICY "Managers and above can manage inventory"
ON inventory FOR ALL
USING (
  organization_id = auth.organization_id()
  AND auth.user_role() IN ('owner', 'admin', 'manager')
);

-- ============================================================================
-- SALES
-- ============================================================================
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- All users can view sales
CREATE POLICY "Users can view sales in their organization"
ON sales FOR SELECT
USING (organization_id = auth.organization_id());

-- All users can create sales
CREATE POLICY "Users can create sales"
ON sales FOR INSERT
WITH CHECK (organization_id = auth.organization_id());

-- Managers and above can update any sale, employees can only update their own
CREATE POLICY "Users can update sales based on role"
ON sales FOR UPDATE
USING (
  organization_id = auth.organization_id()
  AND (
    auth.user_role() IN ('owner', 'admin', 'manager')
    OR (auth.user_role() = 'employee' AND created_by = auth.uid())
  )
);

-- ============================================================================
-- SALE ITEMS
-- ============================================================================
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Users can view sale items for sales in their organization
CREATE POLICY "Users can view sale items in their organization"
ON sale_items FOR SELECT
USING (organization_id = auth.organization_id());

-- Users can create sale items
CREATE POLICY "Users can create sale items"
ON sale_items FOR INSERT
WITH CHECK (organization_id = auth.organization_id());

-- Users can update sale items (through parent sale permissions)
CREATE POLICY "Users can update sale items"
ON sale_items FOR UPDATE
USING (organization_id = auth.organization_id());

-- Users can delete sale items (through parent sale permissions)
CREATE POLICY "Users can delete sale items"
ON sale_items FOR DELETE
USING (organization_id = auth.organization_id());

-- ============================================================================
-- PAYMENTS
-- ============================================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- All users can view payments
CREATE POLICY "Users can view payments in their organization"
ON payments FOR SELECT
USING (organization_id = auth.organization_id());

-- All users can create payments
CREATE POLICY "Users can create payments"
ON payments FOR INSERT
WITH CHECK (organization_id = auth.organization_id());

-- Managers and above can update payments
CREATE POLICY "Managers and above can update payments"
ON payments FOR UPDATE
USING (
  organization_id = auth.organization_id()
  AND auth.user_role() IN ('owner', 'admin', 'manager')
);

-- ============================================================================
-- EXPENSES
-- ============================================================================
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- All users can view expenses
CREATE POLICY "Users can view expenses in their organization"
ON expenses FOR SELECT
USING (organization_id = auth.organization_id());

-- Managers and above can create expenses
CREATE POLICY "Managers and above can create expenses"
ON expenses FOR INSERT
WITH CHECK (
  organization_id = auth.organization_id()
  AND auth.user_role() IN ('owner', 'admin', 'manager')
);

-- Managers and above can update expenses
CREATE POLICY "Managers and above can update expenses"
ON expenses FOR UPDATE
USING (
  organization_id = auth.organization_id()
  AND auth.user_role() IN ('owner', 'admin', 'manager')
);
