-- ============================================================================
-- SEED DATA - LOCAL DEVELOPMENT ONLY
-- ============================================================================
-- PRODUCTION: This file runs but creates NO business data.
--             Every organization starts completely empty.
--             The onboarding flow guides users to create their own data.
--
-- LOCAL DEV:  Uncomment the demo organization block below to get
--             a login to test the post-onboarding app experience.
--             Do NOT seed products, customers, or inventory here.
-- ============================================================================

-- ============================================================================
-- (OPTIONAL) DEMO ORGANIZATION FOR LOCAL DEVELOPMENT
-- Uncomment to use. Never runs in production.
-- ============================================================================

/*

INSERT INTO organizations (id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'My Wholesale Business',
  'my-wholesale'
);

-- Create owner user profile AFTER registering with Supabase Auth.
-- Replace the UUID below with the actual auth.users.id after signup.
--
-- INSERT INTO user_profiles (id, organization_id, email, full_name, role)
-- VALUES (
--   '<your-auth-user-id>',
--   '00000000-0000-0000-0000-000000000001',
--   'owner@example.com',
--   'Business Owner',
--   'owner'
-- );

*/

-- ============================================================================
-- PRODUCTION BEHAVIOR
-- ============================================================================
-- No business data is pre-loaded.
-- When a user signs up:
--   1. Supabase Auth creates auth.users record
--   2. Onboarding creates organizations record
--   3. Onboarding creates user_profiles record with role 'owner'
--   4. User adds their own products, customers, inventory
--
-- This ensures the application works for ANY wholesale business
-- without assumptions about industry, products, or customers.
