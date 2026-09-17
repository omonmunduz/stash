-- ============================================================================
-- PUBLIC LANDING PAGE SCHEMA ADDITIONS
-- ============================================================================
-- Adds fields needed for the public-facing org landing page:
-- - Organizations: description, hero_image_url, logo_url
-- - Services: visible_on_landing_page
-- - Products: visible_on_landing_page
--
-- All visibility flags default to TRUE so existing data is visible by default.
-- ============================================================================

-- ============================================================================
-- ORGANIZATIONS: Landing page content
-- ============================================================================
ALTER TABLE organizations
  ADD COLUMN description TEXT,
  ADD COLUMN hero_image_url TEXT,
  ADD COLUMN logo_url TEXT;

COMMENT ON COLUMN organizations.description IS
  'Public-facing description shown on the org landing page.';
COMMENT ON COLUMN organizations.hero_image_url IS
  'Hero/banner image URL for the org landing page.';
COMMENT ON COLUMN organizations.logo_url IS
  'Organization logo URL shown on landing page and booking pages.';

-- ============================================================================
-- SERVICES: Landing page visibility
-- ============================================================================
ALTER TABLE services
  ADD COLUMN visible_on_landing_page BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN services.visible_on_landing_page IS
  'Whether this service is shown on the public org landing page.
   Defaults to TRUE so existing services remain visible.';

-- ============================================================================
-- PRODUCTS: Landing page visibility
-- ============================================================================
ALTER TABLE products
  ADD COLUMN visible_on_landing_page BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN products.visible_on_landing_page IS
  'Whether this product is shown on the public org landing page.
   Defaults to TRUE so existing products remain visible.';
