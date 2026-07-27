-- ============================================================================
-- CANONICAL SCHEMA — MVP
-- ============================================================================
-- This is the single source of truth for the database structure. It replaces
-- the earlier nine-file migration history, which contained create-then-drop
-- churn (triggers defined in one migration and replaced in another) and three
-- statements that could not execute at all.
--
-- Migration order and why it matters:
--   000001_schema.sql             tables, columns, indexes  (this file)
--   000002_auth_helpers.sql       auth.organization_id() etc.
--   000003_row_level_security.sql policies — depend on the helpers above
--   000004_business_logic.sql     triggers — depend on the tables above
--
-- Scope: single location, no barcode scanning, no billing. Those are Phase 2
-- and each arrives as its own additive migration.
-- ============================================================================

-- No UUID extension needed. gen_random_uuid() is in the Postgres core since 13,
-- so it resolves without a search_path qualifier. uuid-ossp's gen_random_uuid()
-- does not: Supabase pre-installs that extension into the `extensions` schema,
-- which makes CREATE EXTENSION IF NOT EXISTS a silent no-op and leaves the
-- function unreachable from the search_path migrations run under.

-- ============================================================================
-- ENUMS
-- ============================================================================
CREATE TYPE user_role      AS ENUM ('owner', 'admin', 'manager', 'employee');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'bank_transfer', 'check', 'other');
CREATE TYPE sale_status    AS ENUM ('draft', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('unpaid', 'partial', 'paid');

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================
-- One row per business using the platform. No subscription or Stripe columns:
-- billing does not exist yet, and a trial_ends_at written now would be a live
-- timer with no code reading it — the day enforcement is added, every existing
-- business locks out retroactively.
CREATE TABLE organizations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    slug       TEXT UNIQUE NOT NULL,
    settings   JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_organizations_slug ON organizations(slug) WHERE deleted_at IS NULL;

COMMENT ON TABLE organizations IS
  'Multi-tenant root. Every business row carries organization_id and is isolated by RLS.';
COMMENT ON COLUMN organizations.settings IS
  'Business preferences (currency, timezone, tax rate). JSONB so adding a preference needs no migration.';

-- ============================================================================
-- USER PROFILES
-- ============================================================================
-- Extends auth.users with business context. organization_id is NOT NULL, so a
-- profile row cannot exist before the organization does. This is why onboarding
-- runs through the service-role client: a brand-new user has no organization,
-- and RLS gives them no way to create one.
CREATE TABLE user_profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    phone           TEXT,
    role            user_role NOT NULL DEFAULT 'employee',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_user_profiles_org   ON user_profiles(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

COMMENT ON TABLE user_profiles IS
  'Business identity for an auth.users row: which organization, which role.';
COMMENT ON COLUMN user_profiles.role IS
  'RBAC ranking: owner > admin > manager > employee.';
COMMENT ON COLUMN user_profiles.is_active IS
  'FALSE deactivates the user at the application layer. NOTE: auth.organization_id()
   does not filter on this, so a deactivated user with a live token can still read
   organization data through RLS. Tracked as a known gap — see 000002_auth_helpers.sql.';

-- ============================================================================
-- CUSTOMERS
-- ============================================================================
CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_code   TEXT NOT NULL,
    name            TEXT NOT NULL,
    business_name   TEXT,
    email           TEXT,
    phone           TEXT,
    address         TEXT,
    city            TEXT,
    credit_limit    DECIMAL(15, 2),
    current_balance DECIMAL(15, 2) DEFAULT 0,
    notes           TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      UUID REFERENCES user_profiles(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE(organization_id, customer_code)
);

CREATE INDEX idx_customers_org         ON customers(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_org_code    ON customers(organization_id, customer_code);
CREATE INDEX idx_customers_org_balance ON customers(organization_id, is_active, current_balance) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_phone       ON customers(organization_id, phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE customers IS 'People and shops that buy, often on credit.';
COMMENT ON COLUMN customers.current_balance IS
  'Denormalized debt figure, maintained by trigger. Never write this from the app —
   it is recomputed from completed sales and unallocated payments.';
COMMENT ON COLUMN customers.credit_limit IS
  'Advisory ceiling on debt. NULL means no limit. Enforced in the application layer.';

-- ============================================================================
-- PRODUCTS
-- ============================================================================
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sku             TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    category        TEXT,
    unit_of_measure TEXT DEFAULT 'unit',
    cost_price      DECIMAL(15, 2) NOT NULL DEFAULT 0,
    sale_price      DECIMAL(15, 2) NOT NULL DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      UUID REFERENCES user_profiles(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE(organization_id, sku)
);

CREATE INDEX idx_products_org        ON products(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_org_sku    ON products(organization_id, sku);
CREATE INDEX idx_products_org_active ON products(organization_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_name       ON products(organization_id, name) WHERE deleted_at IS NULL;

COMMENT ON TABLE products IS 'What the business sells.';
COMMENT ON COLUMN products.cost_price IS 'What the business paid. Profit = sale_price - cost_price.';

-- ============================================================================
-- INVENTORY
-- ============================================================================
-- One row per product per organization. No warehouse_id: the MVP is single
-- location. Phase 2 adds warehouse_id and widens the UNIQUE constraint.
--
-- Invariant: every product has exactly one inventory row, created automatically
-- by trigger (see 000004_business_logic.sql). This lets every stock query use a
-- plain JOIN instead of a LEFT JOIN with a COALESCE, and means a sale can never
-- silently skip stock deduction because a row was missing.
CREATE TABLE inventory (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_on_hand DECIMAL(15, 3) DEFAULT 0 CHECK (quantity_on_hand >= 0),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, product_id)
);

CREATE INDEX idx_inventory_org     ON inventory(organization_id);
CREATE INDEX idx_inventory_product ON inventory(organization_id, product_id);

COMMENT ON TABLE inventory IS 'Current stock level per product. Single location.';
COMMENT ON COLUMN inventory.quantity_on_hand IS
  'CHECK (>= 0) is the last line of defence against overselling. The completion
   trigger raises a readable error before this constraint would fire.';

-- ============================================================================
-- SALES
-- ============================================================================
-- sale_number is NULLABLE and assigned when the sale is completed, not when the
-- draft is created.
--
-- Reasoning: a draft is not an invoice. If numbers were handed out at draft
-- creation, deleting a draft would leave a permanent hole in the invoice
-- sequence, which is the first thing an accountant asks about. Assigning on
-- completion means the sequence is gap-free by construction. The trade-off is
-- that sale_number is null while status = 'draft', so the application must treat
-- it as optional and show drafts by customer and date instead.
--
-- The previous schema had this half-built: a NOT NULL sale_number plus a
-- separate draft_number column whose own comment said sale_number was null
-- until completion. Those cannot both be true.
CREATE TABLE sales (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sale_number     TEXT,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sale_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date        DATE,
    status          sale_status DEFAULT 'draft',
    subtotal        DECIMAL(15, 2) DEFAULT 0,
    tax             DECIMAL(15, 2) DEFAULT 0,
    discount        DECIMAL(15, 2) DEFAULT 0,
    total           DECIMAL(15, 2) DEFAULT 0,
    amount_paid     DECIMAL(15, 2) DEFAULT 0,
    amount_due      DECIMAL(15, 2) DEFAULT 0,
    payment_status  payment_status DEFAULT 'unpaid',
    notes           TEXT,
    created_by      UUID REFERENCES user_profiles(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    -- A completed sale must carry a number. A draft must not.
    -- 'cancelled' is deliberately unconstrained: a sale can be cancelled from
    -- draft (never numbered) or from completed (keeps its number for the audit
    -- trail), so neither NULL nor NOT NULL is wrong for that state.
    CONSTRAINT sales_completed_has_number CHECK (
        (status = 'completed' AND sale_number IS NOT NULL)
        OR (status = 'draft' AND sale_number IS NULL)
        OR status = 'cancelled'
    )
);

-- Partial unique index rather than a table constraint: soft-deleted sales must
-- not block a number, and drafts hold NULL which a plain UNIQUE would allow
-- many of anyway.
CREATE UNIQUE INDEX sales_number_unique
  ON sales(organization_id, sale_number)
  WHERE sale_number IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_sales_org      ON sales(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_customer ON sales(organization_id, customer_id, payment_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_date     ON sales(organization_id, sale_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_overdue
  ON sales(organization_id, due_date, payment_status)
  WHERE status = 'completed' AND payment_status IN ('unpaid', 'partial') AND deleted_at IS NULL;

COMMENT ON TABLE sales IS 'Sales and invoices. draft = editable, completed = final, cancelled = void.';
COMMENT ON COLUMN sales.sale_number IS
  'Invoice number (INV-2026-0001). NULL while the sale is a draft; assigned by
   trigger on completion so the sequence has no gaps.';
COMMENT ON COLUMN sales.amount_due IS
  'Denormalized: total - amount_paid. Maintained by trigger, never written by the app.';

-- ============================================================================
-- SALE ITEMS
-- ============================================================================
-- product_name, sku, unit_price and cost_price are snapshots taken at sale time.
-- Products get renamed and repriced; an invoice printed a year later must still
-- show what was actually sold and what it actually cost.
CREATE TABLE sale_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name    TEXT NOT NULL,
    product_sku     TEXT,
    quantity        DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
    unit_price      DECIMAL(15, 2) NOT NULL,
    cost_price      DECIMAL(15, 2) NOT NULL DEFAULT 0,
    discount        DECIMAL(15, 2) DEFAULT 0,
    subtotal        DECIMAL(15, 2) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sale_items_sale         ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product      ON sale_items(organization_id, product_id);
CREATE INDEX idx_sale_items_product_date ON sale_items(product_id, created_at DESC);

COMMENT ON TABLE sale_items IS 'Line items on a sale. All product fields are point-in-time snapshots.';
COMMENT ON COLUMN sale_items.cost_price IS
  'Snapshot of product cost at sale time. Without it, gross profit on old invoices
   changes retroactively every time a supplier price changes.';
COMMENT ON COLUMN sale_items.subtotal IS 'Calculated by the app: (quantity * unit_price) - discount.';

-- ============================================================================
-- PAYMENTS
-- ============================================================================
CREATE TABLE payments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    payment_number   TEXT NOT NULL,
    customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sale_id          UUID REFERENCES sales(id) ON DELETE SET NULL,
    payment_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    amount           DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    payment_method   payment_method NOT NULL,
    reference_number TEXT,
    notes            TEXT,
    created_by       UUID REFERENCES user_profiles(id),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ,
    UNIQUE(organization_id, payment_number)
);

CREATE INDEX idx_payments_org           ON payments(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_customer      ON payments(organization_id, customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_date          ON payments(organization_id, payment_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_sale          ON payments(organization_id, sale_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_customer_date ON payments(customer_id, payment_date DESC) WHERE deleted_at IS NULL;

-- Guards against recording the same cheque or transfer twice, which is the most
-- common data-entry error in a cash business.
CREATE UNIQUE INDEX payments_reference_unique
  ON payments(organization_id, reference_number)
  WHERE reference_number IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE payments IS
  'Ledger of money actually received. No payment processing — this records reality, it does not create it.';
COMMENT ON COLUMN payments.sale_id IS
  'NULL means unallocated (an advance or a lump sum against overall debt) and reduces
   the customer balance directly. Set means the payment is applied to that invoice.';

-- ============================================================================
-- EXPENSES
-- ============================================================================
CREATE TABLE expenses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    expense_number  TEXT NOT NULL,
    expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    category        TEXT NOT NULL,
    vendor          TEXT,
    amount          DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    payment_method  payment_method NOT NULL,
    description     TEXT NOT NULL,
    receipt_url     TEXT,
    created_by      UUID REFERENCES user_profiles(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE(organization_id, expense_number)
);

CREATE INDEX idx_expenses_org      ON expenses(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_date     ON expenses(organization_id, expense_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_category ON expenses(organization_id, category) WHERE deleted_at IS NULL;

COMMENT ON TABLE expenses IS 'Money spent. Net profit = gross profit from sales - expenses.';
COMMENT ON COLUMN expenses.category IS 'Free text for the MVP. Becomes a lookup table if reporting needs it.';

-- ============================================================================
-- updated_at MAINTENANCE
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column IS 'Stamps updated_at on every UPDATE.';

CREATE TRIGGER trg_organizations_updated_at  BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_user_profiles_updated_at  BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_customers_updated_at      BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_products_updated_at       BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_inventory_updated_at      BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_sales_updated_at          BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_payments_updated_at       BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_expenses_updated_at       BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
