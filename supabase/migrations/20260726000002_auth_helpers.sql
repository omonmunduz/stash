-- ============================================================================
-- AUTH HELPERS
-- ============================================================================
-- Functions every RLS policy calls. Defined once here, in final form.
--
-- The previous history defined auth.organization_id() and auth.user_role() twice
-- (a DB-query version, then a JWT version that replaced it). Only the final
-- version survives.
--
-- Claims are written to app_metadata during onboarding:
--   { "organization_id": "<uuid>", "role": "owner" }
-- app_metadata is chosen over user_metadata because the user cannot modify it —
-- user_metadata is editable by the client and would let anyone rewrite their own
-- organization_id and role.
-- ============================================================================

-- Returns the caller's organization, or NULL if they have none yet.
--
-- The JWT path is the fast path: no query. The DB fallback covers the window
-- between account creation and the first token refresh, when the claim is not
-- in the token yet. Without the fallback, a user who just finished onboarding
-- would be treated as having no organization until their token rolled over.
CREATE OR REPLACE FUNCTION auth.organization_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid,
    (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION auth.organization_id IS
  'Current user''s organization. Reads the JWT claim, falls back to user_profiles.

   KNOWN GAP: no is_active filter. A deactivated employee holding an unexpired
   token still passes RLS and can read organization data until that token expires.
   Deactivation is currently enforced only in the application layer. Closing this
   properly means filtering on is_active here AND revoking the session on
   deactivation. This should be resolved before the product is used by a business
   with employees who can be fired.';

-- Returns the caller's role, or NULL if they have no profile.
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role')::user_role,
    (SELECT role FROM user_profiles WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION auth.user_role IS
  'Current user''s role. JWT claim first, user_profiles fallback.';

-- Role ranking, so policies can express "manager or above" without repeating
-- the IN (...) list and drifting out of sync.
CREATE OR REPLACE FUNCTION auth.has_role_or_above(required_role user_role)
RETURNS BOOLEAN AS $$
  SELECT CASE auth.user_role()
    WHEN 'owner'    THEN TRUE
    WHEN 'admin'    THEN required_role IN ('admin', 'manager', 'employee')
    WHEN 'manager'  THEN required_role IN ('manager', 'employee')
    WHEN 'employee' THEN required_role = 'employee'
    ELSE FALSE
  END;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION auth.has_role_or_above IS
  'TRUE when the caller''s role is at least required_role. owner > admin > manager > employee.';
