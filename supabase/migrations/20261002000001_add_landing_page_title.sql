-- Add landing_page_title to organizations table
-- This allows businesses to set a custom title for their public landing page
-- separate from their business name

ALTER TABLE organizations
ADD COLUMN landing_page_title TEXT;

COMMENT ON COLUMN organizations.landing_page_title IS 'Custom title displayed on the public landing page hero section. If null, falls back to organization name.';
