-- ============================================================================
-- MVP DATABASE SCHEMA - SIMPLIFIED
-- ============================================================================
-- This schema supports the core MVP features:
-- - Multi-tenant foundation
-- - Customer debt tracking
-- - Product catalog with cost/sale pricing
-- - Simple inventory (single location)
-- - Sales with line items
-- - Manual payment recording (ledger only, no payment processing)
-- - Expense tracking
--
-- Postponed features (can be added later without major redesign):
-- - Multiple warehouses
-- - Barcode scanning
-- - Subscription billing
-- - Supplier management
-- - Purchase orders
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'manager', 'employee');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'bank_transfer', 'check', 'other');
CREATE TYPE sale_status AS ENUM ('draft', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('unpaid', 'partial', 'paid');

-- ============================================================================
-- ORGANIZATIONS TABLE
-- ============================================================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_organizations_slug ON organizations(slug) WHERE deleted_at IS NULL;

COMMENT ON TABLE organizations IS 'Multi-tenant: each organization is a separate business using the platform';
COMMENT ON COLUMN organizations.settings IS 'Flexible JSONB field for business-specific settings (currency, tax rate, etc.)';

-- ============================================================================
-- USER PROFILES TABLE
-- ============================================================================
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'employee',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_user_profiles_org ON user_profiles(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

COMMENT ON TABLE user_profiles IS 'Extends Supabase auth.users with business context and roles';
COMMENT ON COLUMN user_profiles.role IS 'RBAC: owner > admin > manager > employee';

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_code TEXT NOT NULL,
    name TEXT NOT NULL,
    business_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    credit_limit DECIMAL(15, 2),
    current_balance DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(organization_id, customer_code)
);

CREATE INDEX idx_customers_org ON customers(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_org_code ON customers(organization_id, customer_code);
CREATE INDEX idx_customers_org_balance ON customers(organization_id, is_active, current_balance) WHERE deleted_at IS NULL;

COMMENT ON TABLE customers IS 'Business customers who buy products on credit';
COMMENT ON COLUMN customers.customer_code IS 'Human-readable ID like CUST-0001';
COMMENT ON COLUMN customers.credit_limit IS 'Maximum amount customer can owe';
COMMENT ON COLUMN customers.current_balance IS 'Denormalized: amount customer currently owes (updated by triggers)';

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unit_of_measure TEXT DEFAULT 'unit',
    cost_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    sale_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(organization_id, sku)
);

CREATE INDEX idx_products_org ON products(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_org_sku ON products(organization_id, sku);
CREATE INDEX idx_products_org_active ON products(organization_id, is_active) WHERE deleted_at IS NULL;

COMMENT ON TABLE products IS 'Product catalog: what the business sells';
COMMENT ON COLUMN products.sku IS 'Stock Keeping Unit - unique product identifier';
COMMENT ON COLUMN products.cost_price IS 'What the business pays for the product';
COMMENT ON COLUMN products.sale_price IS 'What the customer pays (profit = sale_price - cost_price)';

-- ============================================================================
-- INVENTORY TABLE
-- ============================================================================
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_on_hand DECIMAL(15, 3) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, product_id)
);

CREATE INDEX idx_inventory_org ON inventory(organization_id);
CREATE INDEX idx_inventory_product ON inventory(organization_id, product_id);

COMMENT ON TABLE inventory IS 'Simple inventory tracking: one quantity per product per organization';
COMMENT ON COLUMN inventory.quantity_on_hand IS 'Current stock level (reduced when sales are completed)';

-- ============================================================================
-- SALES TABLE
-- ============================================================================
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sale_number TEXT NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status sale_status DEFAULT 'draft',
    subtotal DECIMAL(15, 2) DEFAULT 0,
    tax DECIMAL(15, 2) DEFAULT 0,
    discount DECIMAL(15, 2) DEFAULT 0,
    total DECIMAL(15, 2) DEFAULT 0,
    amount_paid DECIMAL(15, 2) DEFAULT 0,
    amount_due DECIMAL(15, 2) DEFAULT 0,
    payment_status payment_status DEFAULT 'unpaid',
    notes TEXT,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(organization_id, sale_number)
);

CREATE INDEX idx_sales_org ON sales(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_org_number ON sales(organization_id, sale_number);
CREATE INDEX idx_sales_customer ON sales(organization_id, customer_id, payment_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_date ON sales(organization_id, sale_date) WHERE deleted_at IS NULL;

COMMENT ON TABLE sales IS 'Sales transactions / invoices';
COMMENT ON COLUMN sales.sale_number IS 'Human-readable invoice number like INV-2024-0001';
COMMENT ON COLUMN sales.status IS 'draft = being created, completed = finalized (inventory reduced), cancelled = void';
COMMENT ON COLUMN sales.amount_paid IS 'Denormalized: sum of payments received (updated by triggers)';
COMMENT ON COLUMN sales.amount_due IS 'Denormalized: total - amount_paid (updated by triggers)';
COMMENT ON COLUMN sales.payment_status IS 'unpaid = no payments, partial = some paid, paid = fully paid';

-- ============================================================================
-- SALE ITEMS TABLE
-- ============================================================================
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    quantity DECIMAL(15, 3) NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    discount DECIMAL(15, 2) DEFAULT 0,
    subtotal DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(organization_id, product_id);

COMMENT ON TABLE sale_items IS 'Line items on sales/invoices';
COMMENT ON COLUMN sale_items.product_name IS 'Snapshot: product name at time of sale (products can be renamed later)';
COMMENT ON COLUMN sale_items.unit_price IS 'Snapshot: price at time of sale (prices can change later)';
COMMENT ON COLUMN sale_items.subtotal IS 'Calculated: (quantity * unit_price) - discount';

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    payment_number TEXT NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method payment_method NOT NULL,
    reference_number TEXT,
    notes TEXT,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(organization_id, payment_number)
);

CREATE INDEX idx_payments_org ON payments(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_customer ON payments(organization_id, customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_date ON payments(organization_id, payment_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_sale ON payments(organization_id, sale_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE payments IS 'Manual payment ledger: records money received in real world (no payment processing)';
COMMENT ON COLUMN payments.payment_number IS 'Human-readable like PAY-2024-0001';
COMMENT ON COLUMN payments.sale_id IS 'Optional: payment can be unallocated (advance payment) or allocated to specific sale';
COMMENT ON COLUMN payments.payment_method IS 'How customer paid: cash, card, bank_transfer, check, other';
COMMENT ON COLUMN payments.reference_number IS 'Check number, bank transaction ID, etc.';

-- ============================================================================
-- EXPENSES TABLE
-- ============================================================================
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    expense_number TEXT NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL,
    vendor TEXT,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method payment_method NOT NULL,
    description TEXT NOT NULL,
    receipt_url TEXT,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(organization_id, expense_number)
);

CREATE INDEX idx_expenses_org ON expenses(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_date ON expenses(organization_id, expense_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_category ON expenses(organization_id, category) WHERE deleted_at IS NULL;

COMMENT ON TABLE expenses IS 'Business expenses: money spent';
COMMENT ON COLUMN expenses.expense_number IS 'Human-readable like EXP-2024-0001';
COMMENT ON COLUMN expenses.category IS 'Simple text category (can become a table in Phase 2)';
COMMENT ON COLUMN expenses.receipt_url IS 'Optional: link to receipt image in Supabase Storage';

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column IS 'Automatically updates updated_at timestamp on row modification';

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
