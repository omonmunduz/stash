-- ============================================================================
-- BILLING ROW LEVEL SECURITY
-- ============================================================================
-- Tenant isolation for billing tables. Regular users see only their org's
-- data. Super admins bypass RLS using service-role client.
--
-- Design decisions:
-- - Billing tables readable by all roles (for billing page)
-- - Only admins/owners can see full subscription details
-- - Super admin access handled via service-role client (no RLS policies)
-- - Webhook writes happen via service-role (bypasses RLS)
-- ============================================================================

-- ============================================================================
-- PLANS (Public Read)
-- ============================================================================
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active plans (for plan selection UI)
CREATE POLICY "plans_select_active"
ON plans FOR SELECT TO authenticated
USING (is_active = TRUE);

-- No INSERT/UPDATE/DELETE policies - admins use service-role client

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own organization's subscription
CREATE POLICY "subscriptions_select_own_org"
ON subscriptions FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- No INSERT/UPDATE/DELETE policies - managed by billing system only

-- ============================================================================
-- INVOICES
-- ============================================================================
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Users can read their own organization's invoices
CREATE POLICY "invoices_select_own_org"
ON invoices FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- No INSERT/UPDATE/DELETE policies - managed by billing system only

-- ============================================================================
-- PAYMENTS
-- ============================================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can read their own organization's payments
CREATE POLICY "payments_select_own_org"
ON payments FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- No INSERT/UPDATE/DELETE policies - managed by billing system only

-- ============================================================================
-- WEBHOOK EVENTS (No RLS - internal only)
-- ============================================================================
-- Webhook events are internal data, not exposed to clients
-- Access via service-role only
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- No policies - service-role client only

-- ============================================================================
-- ADMIN AUDIT LOG (No RLS - internal only)
-- ============================================================================
-- Audit log is internal data for compliance
-- Super admins access via service-role client
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- No policies - service-role client only

-- ============================================================================
-- HELPER FUNCTION FOR SUPER ADMIN CHECK
-- ============================================================================
-- Returns TRUE if current user is a super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() = 'super_admin';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.is_super_admin IS
  'Returns TRUE if current user has super_admin role. Used in application layer guards.';
