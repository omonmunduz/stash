-- ============================================================================
-- AUTH CLAIMS OPTIMIZATION
-- ============================================================================
-- Update auth helper functions to read from JWT claims first (no extra query)
-- with fallback to DB query for backward compatibility.
--
-- JWT claims are set in app_metadata during onboarding:
--   { organization_id: "uuid", role: "owner" }
--
-- This makes every RLS policy evaluation faster because organization_id
-- is read directly from the JWT rather than issuing a DB lookup.
-- ============================================================================

-- Replace the auth.organization_id() function from migration 002
CREATE OR REPLACE FUNCTION auth.organization_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    -- Fast path: read from JWT claims (set during onboarding)
    (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid,
    -- Slow path: DB query fallback (handles sessions before claims were set)
    (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION auth.organization_id IS
  'Returns the organization_id for the current user. Reads from JWT claims
   (fast) with fallback to user_profiles table (slow). JWT claims are
   populated in app_metadata during onboarding.';

-- Replace the auth.user_role() function from migration 002
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
  SELECT COALESCE(
    -- Fast path: read from JWT claims
    (auth.jwt() -> 'app_metadata' ->> 'role')::user_role,
    -- Slow path: DB query fallback
    (SELECT role FROM user_profiles WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION auth.user_role IS
  'Returns the role for the current user. Reads from JWT claims (fast)
   with fallback to user_profiles table (slow).';

-- Helper: check if current user has completed onboarding (has an org)
CREATE OR REPLACE FUNCTION auth.has_organization()
RETURNS BOOLEAN AS $$
  SELECT auth.organization_id() IS NOT NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: check if current user has minimum role level
-- Useful for complex RLS policies
CREATE OR REPLACE FUNCTION auth.has_role_or_above(required_role user_role)
RETURNS BOOLEAN AS $$
  SELECT CASE auth.user_role()
    WHEN 'owner'    THEN TRUE
    WHEN 'admin'    THEN required_role IN ('admin', 'manager', 'employee')
    WHEN 'manager'  THEN required_role IN ('manager', 'employee')
    WHEN 'employee' THEN required_role = 'employee'
    ELSE FALSE
  END;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
