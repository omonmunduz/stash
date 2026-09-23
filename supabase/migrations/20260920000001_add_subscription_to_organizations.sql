-- ============================================================================
-- ADD SUBSCRIPTION FIELDS TO ORGANIZATIONS
-- ============================================================================
-- Adds subscription tracking to the existing organizations table without
-- breaking existing data. All new columns are nullable or have defaults.
-- ============================================================================

-- Add super_admin role to the enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

COMMENT ON TYPE user_role IS
  'User role hierarchy: super_admin (platform admin) > owner > admin > manager > employee';

-- Add subscription fields to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_days INTEGER DEFAULT 30;

-- Set trial_ends_at for existing organizations (30 days from now)
UPDATE organizations
SET trial_ends_at = NOW() + INTERVAL '30 days',
    current_period_end = NOW() + INTERVAL '30 days'
WHERE trial_ends_at IS NULL;

-- Add constraint: trial_ends_at required for trial status
ALTER TABLE organizations
  ADD CONSTRAINT organizations_trial_has_end_date CHECK (
    (subscription_status = 'trial' AND trial_ends_at IS NOT NULL)
    OR subscription_status != 'trial'
  );

-- Index for finding expiring trials
CREATE INDEX IF NOT EXISTS idx_organizations_trial_ending
  ON organizations(trial_ends_at)
  WHERE subscription_status = 'trial' AND deleted_at IS NULL;

-- Index for finding expiring subscriptions
CREATE INDEX IF NOT EXISTS idx_organizations_period_ending
  ON organizations(current_period_end)
  WHERE subscription_status IN ('active', 'past_due') AND deleted_at IS NULL;

COMMENT ON COLUMN organizations.subscription_tier IS
  'Subscription plan tier: trial | basic | pro. No enforcement yet; billing checks this.';

COMMENT ON COLUMN organizations.subscription_status IS
  'Billing status: trial | active | past_due | suspended | cancelled. Controls access.';

COMMENT ON COLUMN organizations.trial_ends_at IS
  'When the 30-day trial period ends. NULL after trial completes.';

COMMENT ON COLUMN organizations.current_period_end IS
  'End of current billing period. Extended on successful payment.';

COMMENT ON COLUMN organizations.grace_days IS
  'Days allowed past due before suspension. Default 30.';
