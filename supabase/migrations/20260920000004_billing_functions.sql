-- ============================================================================
-- BILLING FUNCTIONS & TRIGGERS
-- ============================================================================
-- Helper functions for subscription lifecycle management.
-- ============================================================================

-- ============================================================================
-- INVOICE NUMBER GENERATOR
-- ============================================================================
-- Generates sequential invoice numbers per organization: INV-2026-001
CREATE OR REPLACE FUNCTION generate_invoice_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  year_str TEXT;
  next_num INTEGER;
  invoice_num TEXT;
BEGIN
  year_str := TO_CHAR(NOW(), 'YYYY');

  -- Get next number for this org in this year
  SELECT COALESCE(MAX(
    CASE
      WHEN invoice_number ~ ('^INV-' || year_str || '-[0-9]+$')
      THEN SUBSTRING(invoice_number FROM '[0-9]+$')::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO next_num
  FROM invoices
  WHERE organization_id = org_id;

  -- Format as INV-YYYY-NNN (zero-padded to 3 digits)
  invoice_num := 'INV-' || year_str || '-' || LPAD(next_num::TEXT, 3, '0');

  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_invoice_number IS
  'Generates sequential invoice numbers per organization: INV-2026-001, INV-2026-002, etc.';

-- ============================================================================
-- SYNC ORGANIZATION SUBSCRIPTION STATUS
-- ============================================================================
-- Keeps organizations.subscription_status in sync with subscriptions.status
-- Called by triggers on subscriptions table
CREATE OR REPLACE FUNCTION sync_organization_subscription_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update organization status to match subscription
  UPDATE organizations
  SET
    subscription_status = NEW.status::TEXT,
    current_period_end = NEW.current_period_end,
    updated_at = NOW()
  WHERE id = NEW.organization_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_organization_subscription_status IS
  'Keeps organizations.subscription_status synced with subscriptions.status.';

CREATE TRIGGER trg_sync_org_subscription_status
  AFTER INSERT OR UPDATE OF status, current_period_end
  ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_organization_subscription_status();

-- ============================================================================
-- AUTO-CREATE SUBSCRIPTION FOR NEW ORGANIZATION
-- ============================================================================
-- Every organization gets a subscription record automatically
CREATE OR REPLACE FUNCTION auto_create_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (
    organization_id,
    status,
    trial_ends_at,
    current_period_end,
    grace_days
  ) VALUES (
    NEW.id,
    'trial',
    COALESCE(NEW.trial_ends_at, NOW() + INTERVAL '30 days'),
    COALESCE(NEW.current_period_end, NOW() + INTERVAL '30 days'),
    COALESCE(NEW.grace_days, 30)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_create_subscription IS
  'Automatically creates a trial subscription for every new organization.';

CREATE TRIGGER trg_auto_create_subscription
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_subscription();

-- ============================================================================
-- EXTEND SUBSCRIPTION PERIOD
-- ============================================================================
-- Extends subscription period by interval (typically 1 month)
-- Called when payment succeeds
CREATE OR REPLACE FUNCTION extend_subscription_period(
  p_subscription_id UUID,
  p_interval INTERVAL DEFAULT INTERVAL '1 month'
)
RETURNS VOID AS $$
DECLARE
  v_current_end TIMESTAMPTZ;
  v_new_end TIMESTAMPTZ;
BEGIN
  -- Get current period end
  SELECT current_period_end INTO v_current_end
  FROM subscriptions
  WHERE id = p_subscription_id;

  -- Extend from the later of now or current_period_end
  -- This ensures we don't lose days if payment is late
  v_new_end := GREATEST(NOW(), COALESCE(v_current_end, NOW())) + p_interval;

  -- Update subscription
  UPDATE subscriptions
  SET
    status = 'active',
    current_period_start = COALESCE(v_current_end, NOW()),
    current_period_end = v_new_end,
    updated_at = NOW()
  WHERE id = p_subscription_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION extend_subscription_period IS
  'Extends subscription by interval. Called when invoice is paid successfully.';

-- ============================================================================
-- TRANSITION TO PAST DUE
-- ============================================================================
-- Moves active subscriptions to past_due when period ends
-- Called by daily billing job
CREATE OR REPLACE FUNCTION transition_to_past_due()
RETURNS TABLE(subscription_id UUID, organization_name TEXT) AS $$
BEGIN
  RETURN QUERY
  UPDATE subscriptions s
  SET
    status = 'past_due',
    updated_at = NOW()
  FROM organizations o
  WHERE s.organization_id = o.id
    AND s.status = 'active'
    AND s.current_period_end < NOW()
  RETURNING s.id, o.name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION transition_to_past_due IS
  'Moves active subscriptions past their period_end to past_due status.';

-- ============================================================================
-- TRANSITION TO SUSPENDED
-- ============================================================================
-- Suspends past_due subscriptions after grace period
-- Called by daily billing job
CREATE OR REPLACE FUNCTION transition_to_suspended()
RETURNS TABLE(subscription_id UUID, organization_name TEXT) AS $$
BEGIN
  RETURN QUERY
  UPDATE subscriptions s
  SET
    status = 'suspended',
    updated_at = NOW()
  FROM organizations o
  WHERE s.organization_id = o.id
    AND s.status = 'past_due'
    AND s.current_period_end + (s.grace_days || ' days')::INTERVAL < NOW()
  RETURNING s.id, o.name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION transition_to_suspended IS
  'Suspends subscriptions that have been past_due beyond grace period.';

-- ============================================================================
-- TRANSITION EXPIRED TRIALS
-- ============================================================================
-- Suspends trial subscriptions that have expired
-- Called by daily billing job
CREATE OR REPLACE FUNCTION transition_expired_trials()
RETURNS TABLE(subscription_id UUID, organization_name TEXT) AS $$
BEGIN
  RETURN QUERY
  UPDATE subscriptions s
  SET
    status = 'suspended',
    updated_at = NOW()
  FROM organizations o
  WHERE s.organization_id = o.id
    AND s.status = 'trial'
    AND s.trial_ends_at < NOW()
  RETURNING s.id, o.name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION transition_expired_trials IS
  'Suspends trial subscriptions that have expired without payment.';
