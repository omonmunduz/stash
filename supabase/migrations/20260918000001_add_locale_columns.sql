-- ============================================================================
-- LOCALE SUPPORT
-- ============================================================================
-- Adds locale preferences for users and organizations to support Russian/English.
--
-- user_profiles.locale: per-user language preference for CRM
-- organizations.default_locale: default language for public pages (landing, booking)
-- ============================================================================

-- ============================================================================
-- 1. USER PROFILES LOCALE
-- ============================================================================
-- Staff can choose their preferred language for the CRM interface.
-- Defaults to 'en' for existing users.
ALTER TABLE user_profiles
ADD COLUMN locale TEXT DEFAULT 'en' CHECK (locale IN ('en', 'ru'));

CREATE INDEX idx_user_profiles_locale ON user_profiles(locale);

COMMENT ON COLUMN user_profiles.locale IS
  'User''s preferred language for the CRM interface. Supported: en (English), ru (Russian).';

-- ============================================================================
-- 2. ORGANIZATIONS DEFAULT LOCALE
-- ============================================================================
-- Default language for the organization's public pages (landing page, booking).
-- Visitors can still override via language switcher, but this sets the initial display.
ALTER TABLE organizations
ADD COLUMN default_locale TEXT DEFAULT 'en' CHECK (default_locale IN ('en', 'ru'));

CREATE INDEX idx_organizations_locale ON organizations(default_locale);

COMMENT ON COLUMN organizations.default_locale IS
  'Default language for public-facing pages (landing, booking). Visitors can override with language switcher.';
