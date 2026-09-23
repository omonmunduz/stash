-- ============================================================================
-- BILLING SCHEMA
-- ============================================================================
-- Subscription billing for the platform. Tracks plans, subscriptions,
-- invoices, payments via Finik gateway, webhook events, and admin actions.
--
-- Design decisions:
-- - Money stored as NUMERIC(15,2) - integer tiyin would be better but decimal
--   matches existing schema convention
-- - One subscription per organization (UNIQUE constraint)
-- - Invoices track Finik payment lifecycle via gateway_request_id
-- - Webhook events stored raw for audit and debugging
-- - Admin actions logged for accountability
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================
CREATE TYPE subscription_status AS ENUM (
  'trial',      -- Free trial period
  'active',     -- Paid and current
  'past_due',   -- Payment failed, in grace period
  'suspended',  -- Grace period expired, access restricted
  'cancelled'   -- Manually cancelled by admin or user
);

CREATE TYPE invoice_status AS ENUM (
  'pending',    -- Awaiting payment
  'paid',       -- Successfully paid
  'failed',     -- Payment attempt failed
  'void'        -- Cancelled/invalidated by admin
);

CREATE TYPE payment_source AS ENUM (
  'webhook',    -- Automatic via Finik webhook
  'manual'      -- Manually marked paid by admin
);

-- ============================================================================
-- PLANS
-- ============================================================================
-- Subscription plan definitions. Price in KGS minor units (tiyin).
CREATE TABLE plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  slug            TEXT NOT NULL UNIQUE,
  price_kgs       NUMERIC(15,2) NOT NULL CHECK (price_kgs >= 0),
  interval        TEXT NOT NULL DEFAULT 'monthly',
  description     TEXT,
  features        JSONB DEFAULT '[]'::jsonb,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plans_active ON plans(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE plans IS 'Subscription plan definitions (Basic 500 KGS, Pro 1000 KGS).';
COMMENT ON COLUMN plans.price_kgs IS 'Monthly price in Kyrgyz Som (KGS). Stored as decimal for consistency.';
COMMENT ON COLUMN plans.features IS 'JSON array of feature descriptions for display.';

-- Insert default plans
INSERT INTO plans (name, slug, price_kgs, description, features) VALUES
  (
    'Basic',
    'basic',
    500.00,
    'Essential features for small businesses',
    '["Up to 5 users", "Unlimited customers", "Unlimited products", "Basic reports", "Email support"]'::jsonb
  ),
  (
    'Pro',
    'pro',
    1000.00,
    'Advanced features for growing businesses',
    '["Unlimited users", "Unlimited customers", "Unlimited products", "Advanced reports", "Priority support", "API access", "Custom branding"]'::jsonb
  );

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================
-- One subscription per organization. Tracks current plan and billing status.
CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id             UUID REFERENCES plans(id) ON DELETE RESTRICT,
  status              subscription_status NOT NULL DEFAULT 'trial',
  current_period_start TIMESTAMPTZ,
  current_period_end  TIMESTAMPTZ,
  trial_ends_at       TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  grace_days          INTEGER DEFAULT 30,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_org    ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end
  ON subscriptions(current_period_end)
  WHERE status IN ('active', 'past_due');

COMMENT ON TABLE subscriptions IS 'One subscription per organization. Tracks billing status and current plan.';
COMMENT ON COLUMN subscriptions.plan_id IS 'NULL during trial. Set when first payment is made.';
COMMENT ON COLUMN subscriptions.grace_days IS 'Days after period_end before suspension. Default 30.';

-- ============================================================================
-- INVOICES
-- ============================================================================
-- Billing invoices. One per billing period. Tracks Finik payment lifecycle.
CREATE TABLE invoices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id       UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  invoice_number        TEXT NOT NULL,
  amount_kgs            NUMERIC(15,2) NOT NULL CHECK (amount_kgs > 0),
  currency              TEXT NOT NULL DEFAULT 'KGS',
  period_start          DATE NOT NULL,
  period_end            DATE NOT NULL,
  due_date              DATE NOT NULL,
  status                invoice_status NOT NULL DEFAULT 'pending',

  -- Finik gateway tracking
  gateway_payment_url   TEXT,
  gateway_qr_code_url   TEXT,
  gateway_request_id    TEXT UNIQUE,  -- Our unique ID sent to Finik
  gateway_transaction_id TEXT,         -- Finik's transaction ID after payment

  paid_at               TIMESTAMPTZ,
  voided_at             TIMESTAMPTZ,
  voided_by             UUID REFERENCES user_profiles(id),
  void_reason           TEXT,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, invoice_number)
);

CREATE INDEX idx_invoices_org         ON invoices(organization_id);
CREATE INDEX idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX idx_invoices_status      ON invoices(status);
CREATE INDEX idx_invoices_due_date    ON invoices(due_date) WHERE status = 'pending';
CREATE INDEX idx_invoices_gateway_req ON invoices(gateway_request_id) WHERE gateway_request_id IS NOT NULL;

COMMENT ON TABLE invoices IS 'Billing invoices. Tracks Finik payment requests and status.';
COMMENT ON COLUMN invoices.gateway_request_id IS 'Unique ID we generate and send to Finik. Used to match webhook callbacks.';
COMMENT ON COLUMN invoices.gateway_transaction_id IS 'Finik transaction ID returned after successful payment.';
COMMENT ON COLUMN invoices.invoice_number IS 'Human-readable invoice number (INV-2026-001).';

-- ============================================================================
-- PAYMENTS
-- ============================================================================
-- Successful payment records. Created when invoice is paid.
CREATE TABLE payments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id             UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount_kgs             NUMERIC(15,2) NOT NULL CHECK (amount_kgs > 0),
  currency               TEXT NOT NULL DEFAULT 'KGS',
  paid_via               payment_source NOT NULL,

  -- Gateway data (NULL for manual payments)
  gateway_transaction_id TEXT UNIQUE,
  gateway_raw_payload    JSONB,

  -- Manual payment tracking (NULL for webhook payments)
  marked_paid_by         UUID REFERENCES user_profiles(id),
  admin_note             TEXT,

  paid_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_org     ON payments(organization_id);
CREATE INDEX idx_payments_gateway_txn ON payments(gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL;

COMMENT ON TABLE payments IS 'Successful payment records. Created when invoice paid via webhook or manually.';
COMMENT ON COLUMN payments.paid_via IS 'webhook = automatic via Finik callback, manual = marked by admin.';
COMMENT ON COLUMN payments.admin_note IS 'Required when marked_paid_by is set. Explains why payment was manual.';

-- ============================================================================
-- WEBHOOK EVENTS
-- ============================================================================
-- Raw webhook event log from Finik. Stored for audit and debugging.
CREATE TABLE webhook_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          TEXT NOT NULL DEFAULT 'finik',
  event_type        TEXT,
  gateway_request_id TEXT,  -- Maps to invoices.gateway_request_id
  signature         TEXT,
  signature_valid   BOOLEAN,
  raw_payload       JSONB NOT NULL,
  processed         BOOLEAN DEFAULT FALSE,
  processed_at      TIMESTAMPTZ,
  error_message     TEXT,
  received_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_processed ON webhook_events(processed, received_at);
CREATE INDEX idx_webhook_events_request   ON webhook_events(gateway_request_id) WHERE gateway_request_id IS NOT NULL;

COMMENT ON TABLE webhook_events IS 'Raw webhook event log. Every callback from Finik stored here for audit.';
COMMENT ON COLUMN webhook_events.signature_valid IS 'TRUE if signature verified, FALSE if invalid, NULL if not checked.';
COMMENT ON COLUMN webhook_events.processed IS 'TRUE after successfully handling the event.';

-- ============================================================================
-- ADMIN AUDIT LOG
-- ============================================================================
-- Tracks all super admin actions on subscriptions and billing.
CREATE TABLE admin_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID NOT NULL REFERENCES user_profiles(id),
  action          TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_id      UUID REFERENCES invoices(id) ON DELETE SET NULL,
  details         JSONB,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_admin ON admin_audit_log(admin_user_id, created_at DESC);
CREATE INDEX idx_admin_audit_org   ON admin_audit_log(organization_id, created_at DESC) WHERE organization_id IS NOT NULL;

COMMENT ON TABLE admin_audit_log IS 'Audit trail of all super admin actions. Immutable log.';
COMMENT ON COLUMN admin_audit_log.action IS 'Action type: mark_paid, void_invoice, extend_period, change_plan, suspend, reactivate, cancel, grant_subscription.';
COMMENT ON COLUMN admin_audit_log.details IS 'JSON with action-specific data (old/new values).';
COMMENT ON COLUMN admin_audit_log.note IS 'Admin note explaining why action was taken.';

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER trg_plans_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
