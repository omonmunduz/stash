# Database Schema & Implementation

## Overview

The database uses **PostgreSQL** through Supabase with **Row Level Security (RLS)** enforcing multi-tenant data isolation. Every table includes `organization_id` and RLS policies prevent cross-organization data access.

**Design Philosophy:** The database is the source of truth. Complex operations (inventory adjustments, payment status updates, balance calculations) are enforced by triggers to guarantee consistency.

---

## Core Tables

### organizations

**Purpose:** Multi-tenant root entity. Every user belongs to one organization.

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  subscription_tier subscription_tier DEFAULT 'trial',
  subscription_status subscription_status DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

**Key Decisions:**
- `slug` is unique globally (used in URLs: `app.example.com/acme-wholesale`)
- `subscription_tier` enum: `'trial' | 'free' | 'basic' | 'pro' | 'enterprise'`
- `settings` JSONB for flexible configuration (currency, language, business preferences)
- Soft delete via `deleted_at` (preserves historical data)

**Indexes:**
```sql
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_subscription ON organizations(subscription_status);
```

---

### user_profiles

**Purpose:** User accounts with role-based permissions. Extends Supabase `auth.users`.

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'employee',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

**Key Decisions:**
- `id` matches `auth.users.id` (1:1 relationship)
- `role` enum: `'owner' | 'admin' | 'manager' | 'employee'` (hierarchy: owner > admin > manager > employee)
- `email` duplicated from auth.users for query convenience
- One user per organization (no multi-org support in MVP)

**Indexes:**
```sql
CREATE INDEX idx_user_profiles_org ON user_profiles(organization_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
```

**RLS Policy:**
```sql
-- Users can read profiles in their organization
CREATE POLICY "Users view profiles in org"
ON user_profiles FOR SELECT
USING (organization_id = auth.organization_id());

-- Only owners/admins can modify profiles
CREATE POLICY "Admins manage profiles"
ON user_profiles FOR ALL
USING (
  organization_id = auth.organization_id()
  AND auth.user_role() IN ('owner', 'admin')
);
```

---

### customers

**Purpose:** Businesses or individuals who buy products on credit.

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  customer_code TEXT NOT NULL,
  name TEXT NOT NULL,
  business_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  credit_limit DECIMAL(15,2),  -- NULL = unlimited
  current_balance DECIMAL(15,2) DEFAULT 0,  -- Denormalized (trigger-maintained)
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT customer_code_unique UNIQUE (organization_id, customer_code)
);
```

**Key Decisions:**
- `customer_code` human-readable: `CUST-0001` (unique per org, not global)
- `credit_limit NULL` = no limit enforced
- `current_balance` is **denormalized** (recalculated by trigger when sales/payments change)
  - Why denormalized: Aggregating across sales/payments on every query is slow
  - Kept in sync by `fn_update_customer_balance()` trigger
- All contact fields (`email`, `phone`, `address`) are optional

**Indexes:**
```sql
CREATE INDEX idx_customers_org ON customers(organization_id);
CREATE INDEX idx_customers_code ON customers(organization_id, customer_code);
CREATE INDEX idx_customers_balance ON customers(current_balance) WHERE current_balance > 0;
```

---

### products

**Purpose:** Items sold to customers.

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit_of_measure TEXT DEFAULT 'unit',
  cost_price DECIMAL(15,2) NOT NULL,
  sale_price DECIMAL(15,2) NOT NULL,
  barcode TEXT,  -- Phase 2
  reorder_level INTEGER,  -- Phase 2
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT sku_unique UNIQUE (organization_id, sku),
  CONSTRAINT sale_price_gte_cost CHECK (sale_price >= cost_price)
);
```

**Key Decisions:**
- `sku` unique per org (business's own product code)
- `category` is free text (no predefined list — every industry is different)
- `cost_price` and `sale_price` both required (profit tracking is core feature)
- CHECK constraint enforces `sale_price >= cost_price` (selling at a loss requires explicit override)
- `barcode` and `reorder_level` exist but unused in MVP (Phase 2 features)

**Indexes:**
```sql
CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_products_sku ON products(organization_id, sku);
CREATE INDEX idx_products_category ON products(category) WHERE category IS NOT NULL;
```

---

### inventory

**Purpose:** Current stock levels (single warehouse in MVP).

```sql
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_on_hand DECIMAL(10,3) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT inventory_product_unique UNIQUE (organization_id, product_id),
  CONSTRAINT quantity_non_negative CHECK (quantity_on_hand >= 0)
);
```

**Key Decisions:**
- One record per product (1:1 relationship)
- `quantity_on_hand` cannot go negative (CHECK constraint)
- DECIMAL(10,3) allows fractional quantities (e.g., 1.5 kg)
- No `warehouse_id` in MVP (Phase 2: add for multi-location support)

**Automatic Updates:**
- Sale completed → trigger decreases quantity
- Sale cancelled → trigger restores quantity
- Manual adjustments → service layer calls `repo.adjust()`

**Indexes:**
```sql
CREATE INDEX idx_inventory_org ON inventory(organization_id);
CREATE INDEX idx_inventory_product ON inventory(product_id);
```

---

### sales

**Purpose:** Customer transactions (credit or cash sales).

```sql
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  sale_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  sale_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  status sale_status DEFAULT 'draft',
  subtotal DECIMAL(15,2) DEFAULT 0,  -- Denormalized (from sale_items)
  tax DECIMAL(15,2) DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) DEFAULT 0,  -- Denormalized: subtotal + tax - discount
  amount_paid DECIMAL(15,2) DEFAULT 0,  -- Denormalized (from payments)
  amount_due DECIMAL(15,2) DEFAULT 0,  -- Denormalized: total - amount_paid
  payment_status payment_status DEFAULT 'unpaid',  -- Derived from amount_paid
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT sale_number_unique UNIQUE (organization_id, sale_number)
);
```

**Key Decisions:**
- `sale_number` human-readable: `INV-2024-0001`
- `status` enum: `'draft' | 'completed' | 'cancelled'`
  - `draft`: items can be edited, inventory not affected
  - `completed`: final, inventory decreased, customer charged
  - `cancelled`: voided, inventory restored
- `payment_status` enum: `'unpaid' | 'partial' | 'paid'` (derived from `amount_paid` vs `total`)
- **All denormalized fields** maintained by triggers:
  - `subtotal` = SUM(sale_items.subtotal)
  - `total` = subtotal + tax - discount
  - `amount_paid` = SUM(payments.amount)
  - `amount_due` = total - amount_paid
  - `payment_status` = derived from amount_paid vs total

**Why denormalize?** Aggregating line items and payments on every query is slow. Triggers keep these in sync.

**Indexes:**
```sql
CREATE INDEX idx_sales_org ON sales(organization_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_status ON sales(status, payment_status);
CREATE INDEX idx_sales_overdue ON sales(due_date) WHERE payment_status IN ('unpaid', 'partial');
```

---

### sale_items

**Purpose:** Line items in a sale (products + quantities).

```sql
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,  -- Snapshot
  quantity DECIMAL(10,3) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,  -- Snapshot
  cost_price DECIMAL(15,2) NOT NULL,  -- Snapshot (added in migration 005)
  discount DECIMAL(15,2) DEFAULT 0,
  subtotal DECIMAL(15,2) NOT NULL,  -- (quantity × unit_price) - discount
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Decisions:**
- **Snapshots:** `product_name`, `unit_price`, `cost_price` are copied from `products` at sale creation time
  - Why: Products can be renamed or repriced later. Historical invoices must show what was agreed at transaction time.
  - `cost_price` snapshot enables accurate historical profit reporting
- `ON DELETE CASCADE`: deleting a sale deletes its items (orphaned items are meaningless)
- No `updated_at`: items are added or removed, never partially updated

**Indexes:**
```sql
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
```

---

### payments

**Purpose:** Manual ledger entries recording money received.

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  payment_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  sale_id UUID REFERENCES sales(id),  -- Nullable: unallocated payments
  payment_date DATE DEFAULT CURRENT_DATE,
  amount DECIMAL(15,2) NOT NULL,
  payment_method payment_method NOT NULL,
  reference_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT payment_number_unique UNIQUE (organization_id, payment_number),
  CONSTRAINT amount_positive CHECK (amount > 0)
);
```

**Key Decisions:**
- `sale_id` is **nullable**: payment can be unallocated (advance payment or account credit)
- `payment_method` enum: `'cash' | 'card' | 'bank_transfer' | 'check' | 'other'`
- `reference_number` for check numbers, bank transfer IDs, etc.
- Soft delete: voiding a payment is tracked, not erased

**Indexes:**
```sql
CREATE INDEX idx_payments_org ON payments(organization_id);
CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_payments_sale ON payments(sale_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
```

---

### expenses

**Purpose:** Business costs (rent, salaries, utilities, etc.).

```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  expense_number TEXT NOT NULL,
  expense_date DATE DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  vendor TEXT,
  amount DECIMAL(15,2) NOT NULL,
  payment_method payment_method NOT NULL,
  description TEXT NOT NULL,
  receipt_url TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT expense_number_unique UNIQUE (organization_id, expense_number),
  CONSTRAINT amount_positive CHECK (amount > 0)
);
```

**Key Decisions:**
- `category` is free text (no predefined list — every business categorizes differently)
- `receipt_url` links to Supabase Storage (receipt photo uploaded from mobile)
- `vendor` optional (not all expenses have a clear payee)

**Indexes:**
```sql
CREATE INDEX idx_expenses_org ON expenses(organization_id);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
```

---

## Database Triggers

### 1. Inventory Management

**Trigger:** Decrease inventory when sale is completed

```sql
CREATE TRIGGER trg_decrease_inventory_on_sale_completed
AFTER UPDATE ON sales
FOR EACH ROW
WHEN (OLD.status = 'draft' AND NEW.status = 'completed')
EXECUTE FUNCTION fn_decrease_inventory_on_sale_completed();
```

**Logic:**
1. Check all sale_items have sufficient inventory (safety check)
2. If any product insufficient → RAISE EXCEPTION (rolls back transaction)
3. Decrease inventory.quantity_on_hand for each product
4. If quantity goes negative → CHECK constraint fails (rolls back)

**Trigger:** Restore inventory when completed sale is cancelled

```sql
CREATE TRIGGER trg_restore_inventory_on_sale_cancelled
AFTER UPDATE ON sales
FOR EACH ROW
WHEN (OLD.status = 'completed' AND NEW.status = 'cancelled')
EXECUTE FUNCTION fn_restore_inventory_on_sale_cancelled();
```

**Logic:**
1. Increase inventory.quantity_on_hand by sale_items.quantity
2. Reverses the decrease

---

### 2. Sale Totals

**Trigger:** Recalculate sale totals when items change

```sql
CREATE TRIGGER trg_recalculate_sale_totals
AFTER INSERT OR UPDATE OR DELETE ON sale_items
FOR EACH ROW
EXECUTE FUNCTION fn_recalculate_sale_totals();
```

**Logic:**
1. Calculate `subtotal = SUM(sale_items.subtotal)`
2. Calculate `total = subtotal + tax - discount`
3. Calculate `amount_due = total - amount_paid`
4. Update sales table

**Why trigger?** Application code could forget to recalculate. Trigger guarantees consistency.

---

### 3. Payment Status

**Trigger:** Update payment status when payments change

```sql
CREATE TRIGGER trg_update_sale_payment_status_insert
AFTER INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION fn_update_sale_payment_status();

CREATE TRIGGER trg_update_sale_payment_status_delete
AFTER DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION fn_update_sale_payment_status();
```

**Logic:**
1. Calculate `amount_paid = SUM(payments.amount)`
2. Calculate `amount_due = total - amount_paid`
3. Derive `payment_status`:
   - `amount_paid = 0` → `'unpaid'`
   - `0 < amount_paid < total` → `'partial'`
   - `amount_paid >= total` → `'paid'`
4. Update sales table

---

### 4. Customer Balance

**Trigger:** Update customer balance when sales/payments change

```sql
CREATE TRIGGER trg_update_customer_balance_from_sales
AFTER INSERT OR UPDATE OR DELETE ON sales
FOR EACH ROW
EXECUTE FUNCTION fn_update_customer_balance();

CREATE TRIGGER trg_update_customer_balance_from_payments
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION fn_update_customer_balance();
```

**Logic:**
```
current_balance = SUM(completed_sales.amount_due)
                - SUM(unallocated_payments.amount)
```

**Why this formula?**
- Completed sales add debt
- Allocated payments reduce specific sale's amount_due (already counted)
- Unallocated payments reduce overall balance

---

## Row Level Security (RLS) Policies

### Pattern: Organization Isolation

**Every table follows this pattern:**

```sql
-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- SELECT policy: users see only their org's data
CREATE POLICY "org_isolation_select" ON customers
FOR SELECT
USING (organization_id = auth.organization_id());

-- INSERT policy: can only insert into own org
CREATE POLICY "org_isolation_insert" ON customers
FOR INSERT
WITH CHECK (organization_id = auth.organization_id());

-- UPDATE policy: can only update own org's data
CREATE POLICY "org_isolation_update" ON customers
FOR UPDATE
USING (organization_id = auth.organization_id());

-- DELETE policy (soft delete): can only delete own org's data
CREATE POLICY "org_isolation_delete" ON customers
FOR DELETE
USING (organization_id = auth.organization_id());
```

### Helper Functions

**Get organization_id from JWT:**

```sql
CREATE FUNCTION auth.organization_id() RETURNS UUID AS $$
  SELECT COALESCE(
    (auth.jwt()->'app_metadata'->>'organization_id')::uuid,
    (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

**Fast path:** Read from JWT (zero queries)  
**Fallback:** Query user_profiles (handles sessions before JWT claims were set)

**Get user role from JWT:**

```sql
CREATE FUNCTION auth.user_role() RETURNS user_role AS $$
  SELECT COALESCE(
    (auth.jwt()->'app_metadata'->>'role')::user_role,
    (SELECT role FROM user_profiles WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

---

## Indexes Strategy

### 1. Foreign Keys

Every foreign key has an index (Postgres doesn't create these automatically):

```sql
CREATE INDEX idx_customers_org ON customers(organization_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
```

### 2. WHERE Clause Columns

Columns frequently used in WHERE clauses get indexes:

```sql
CREATE INDEX idx_sales_status ON sales(status, payment_status);
CREATE INDEX idx_products_sku ON products(organization_id, sku);
```

### 3. Partial Indexes

Index only relevant rows:

```sql
CREATE INDEX idx_sales_overdue 
ON sales(due_date) 
WHERE payment_status IN ('unpaid', 'partial');
```

### 4. Composite Indexes

For queries with multiple filters:

```sql
CREATE INDEX idx_customers_org_code 
ON customers(organization_id, customer_code);
```

**Why:** Query `WHERE organization_id = ? AND customer_code = ?` uses this single index instead of two separate indexes.

---

## Data Types

### Money

**Type:** `DECIMAL(15,2)`

**Why not FLOAT?** Floating point has precision errors:
```sql
SELECT 0.1 + 0.2;  -- Returns 0.30000000000000004 (wrong!)
```

DECIMAL stores exact values.

**Why (15,2)?**
- 15 total digits
- 2 decimal places
- Max value: 9,999,999,999,999.99 (10 trillion)
- Sufficient for wholesale transactions

### Quantity

**Type:** `DECIMAL(10,3)`

**Why 3 decimal places?** Some products sold by weight (1.5 kg) or fractional units (2.75 boxes).

### Dates

**Type:** `DATE` for business dates, `TIMESTAMPTZ` for audit timestamps

**Why TIMESTAMPTZ?** Stores timezone info. Users in different timezones see correct local time.

---

## Performance Optimizations

### 1. Denormalization

**Denormalized:**
- `sales.subtotal` (instead of SUM(sale_items))
- `sales.amount_paid` (instead of SUM(payments))
- `customers.current_balance` (instead of SUM(sales) - SUM(payments))

**Trade-off:** Writes are slower (trigger overhead), but reads are **10x faster** (no aggregations).

**Decision:** In a wholesale system, reads far outnumber writes. Worth the trade-off.

### 2. Partial Indexes

Index only rows that matter:

```sql
-- Only index customers with outstanding balance
CREATE INDEX idx_customers_with_balance 
ON customers(current_balance) 
WHERE current_balance > 0;
```

Smaller index = faster queries.

### 3. JWT Claims

RLS helper functions read from JWT (instant) instead of querying `user_profiles` (1 extra query per RLS check).

With 10 tables checked per request × 100 requests/sec = 1000 extra queries/sec saved.

---

## Schema Evolution

### Migration Strategy

1. Migrations are **append-only** (never edit old migrations)
2. Each migration is numbered: `20240723000001_description.sql`
3. Destructive changes (column drop) require 2-phase migration:
   - Phase 1: Make column nullable, stop writing to it
   - Phase 2 (1 week later): Drop column

### Adding Columns

**Safe:** Adding nullable columns or columns with defaults

```sql
ALTER TABLE products ADD COLUMN barcode TEXT;
```

**Requires code change first:** Adding NOT NULL columns

```sql
-- Wrong: fails if table has rows
ALTER TABLE products ADD COLUMN required_field TEXT NOT NULL;

-- Right: add as nullable first, backfill, then add constraint
ALTER TABLE products ADD COLUMN required_field TEXT;
UPDATE products SET required_field = 'default' WHERE required_field IS NULL;
ALTER TABLE products ALTER COLUMN required_field SET NOT NULL;
```

---

## Backup & Recovery

**Supabase provides:**
- Daily automatic backups (retained 7 days on free tier)
- Point-in-time recovery (paid plans)

**Manual backup:**
```bash
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup.sql
```

---

## Summary

| Aspect | Implementation | Why |
|--------|----------------|-----|
| **Multi-tenancy** | `organization_id` + RLS on every table | Zero-trust data isolation |
| **Denormalization** | Triggers maintain totals/balances | 10x faster reads |
| **JWT Claims** | `organization_id` in JWT | Zero extra queries for RLS |
| **Soft Deletes** | `deleted_at TIMESTAMPTZ` | Preserves audit trail |
| **Inventory Automation** | Triggers on sale completion/cancellation | Guaranteed consistency |
| **Payment Status** | Derived by trigger from amounts | Single source of truth |
| **Customer Balance** | Recalculated by trigger | Always accurate |

**The database enforces business rules so the application cannot create inconsistent state, even with bugs.**
