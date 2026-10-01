-- ============================================================================
-- ADD LANDING PAGE TITLE TO ORGANIZATIONS
-- ============================================================================
-- Run this in your Supabase SQL Editor to add a custom landing page title field

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS landing_page_title TEXT;

COMMENT ON COLUMN organizations.landing_page_title IS
  'Custom title displayed on the public landing page hero section. If null, falls back to organization name.';

-- Optional: Set a sample title for existing organizations
-- UPDATE organizations
-- SET landing_page_title = 'Welcome to ' || name
-- WHERE landing_page_title IS NULL;
