# Architecture Documentation

## Knowledge Base Index

| Document | Contents |
|----------|----------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System overview, principles, layer design, tech decisions |
| **[DATABASE.md](./DATABASE.md)** | Full schema, indexes, triggers, RLS policies |
| **[BUSINESS-RULES.md](./BUSINESS-RULES.md)** | Domain logic, calculations, validations |
| **[API.md](./API.md)** | Server Actions, REST routes, conventions |
| **[AUTH.md](./AUTH.md)** | Authentication, JWT strategy, permissions |
| **[INVENTORY.md](./INVENTORY.md)** | Inventory rules, lifecycle, profit calculations |
| **[SALES-WORKFLOW.md](./SALES-WORKFLOW.md)** | Sale lifecycle, payment states, cancellation |
| **[ONBOARDING.md](./ONBOARDING.md)** | First-time user experience design |
| **[REPOSITORY-LAYER.md](./REPOSITORY-LAYER.md)** | Repository pattern, service layer |
| **[FOLDER-STRUCTURE.md](./FOLDER-STRUCTURE.md)** | Feature-based directory layout |
| **[DOMAIN-MODELS.md](./DOMAIN-MODELS.md)** | TypeScript types, Zod schemas design |
| **[ROADMAP.md](./ROADMAP.md)** | MVP scope, Phase 2, technical debt |

---

## System Overview

**What it is:** A multi-tenant wholesale management system for small businesses that sell goods on credit to retailers.

**Core problem it solves:** Wholesale owners track hundreds of customers who owe money, dozens of products with changing stock, and daily cash flows — all in paper notebooks or spreadsheets. This system replaces that with a fast, mobile-first digital ledger.

**First customer:** A cookie and snack wholesale business in Kyrgyzstan.

**Stack:**

| Layer | Technology | Why |
|-------|------------|-----|
| Framework | Next.js 15 (App Router) | Server Components, Server Actions, integrated routing |
| Language | TypeScript (strict) | Type safety end-to-end |
| Database | Supabase / PostgreSQL | Auth + DB + RLS + Storage in one service |
| Styling | Tailwind CSS + shadcn/ui | Fast development, full control |
| Validation | Zod | Runtime validation with type inference |

---

## Architectural Principles

### 1. Feature-Based Organization

Code lives by business domain, not technical type. Everything for "customers" is in `src/features/customers/`.

```
src/features/customers/
├── types.ts            ← Domain model
├── validation.ts       ← Zod schemas
├── business-rules.ts   ← Pure domain logic
├── queries.ts          ← Query builders
├── repository.ts       ← Data access
├── service.ts          ← Orchestration
└── hooks.ts            ← React hooks
```

**Why:** A developer working on customers finds every relevant file in one folder. Contrast with layer-based folders where customer logic is split across `/models`, `/services`, `/hooks`, `/components` simultaneously.

---

### 2. Repository Pattern — UI Never Touches Supabase

```
Server Component / Server Action
    ↓
Service (CustomerService)          ← Business logic lives here
    ↓
Repository (CustomerRepository)    ← Abstract interface
    ↓
SupabaseCustomerRepository         ← Concrete implementation
    ↓
queries.ts                         ← Supabase query builders
    ↓
Supabase / PostgreSQL
```

**Consequence:** Swapping Supabase for another database means changing one file per feature (the concrete repository implementation) without touching any business logic or UI.

---

### 3. Database as Source of Truth

Inventory adjustments, payment status, and customer balance are enforced by **PostgreSQL triggers**, not application code.

**Why:** Application code can have bugs. Triggers cannot be bypassed. A sale completion that decreases inventory happens atomically — either both happen or neither does.

**Three-layer defense:**
1. UI validation (instant feedback)
2. Service layer checks (business rules, user-friendly errors)
3. Database triggers + constraints (final safeguard, guaranteed consistency)

---

### 4. Multi-Tenant Isolation via JWT + RLS

Every table has a `organization_id` column. Row Level Security policies filter every query automatically:

```sql
CREATE POLICY "..." ON customers
USING (organization_id = auth.organization_id());
```

`auth.organization_id()` reads from the JWT (no extra query needed), which contains `app_metadata.organization_id` set during onboarding.

**Result:** Even a buggy query without an explicit organization filter cannot return another tenant's data.

---

## Key Design Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Feature-based folders | Scales; locality of code | More initial structure |
| Repository pattern | Testable, replaceable | 5–7 files per feature |
| DB triggers for balances | Guaranteed consistency | Harder to debug trigger logic |
| JWT claims for org_id | Zero extra DB queries per RLS check | Session refresh needed when org changes |
| Server Components default | Smaller JS bundles, faster TTI | Less client-side interactivity |
| `Result<T>` instead of exceptions | Explicit error handling | More verbose than try/catch |
| Denormalized totals | 10× faster reads | Trigger maintenance overhead |
| Single warehouse (MVP) | Simpler queries | Schema change needed for Phase 2 |
| `cost_price` snapshot on sale_items | Accurate historical profit | Slightly more data per row |
| Soft deletes everywhere | Audit trail, data recovery | Queries must filter `deleted_at IS NULL` |

---

## Database Schema Overview

### Core Principles

1. **Multi-tenant from Day 1**: Every table has `organization_id` for tenant isolation
2. **Row Level Security (RLS)**: PostgreSQL policies enforce data isolation at database level
3. **Subscription Foundation**: Billing fields present but not enforced in MVP
4. **Audit Trail**: `created_at`, `updated_at`, `created_by`, `deleted_at` on all business entities
5. **Soft Deletes**: Use `deleted_at` instead of hard deletes for data recovery
6. **Denormalized Balances**: Customer balance and sale totals cached for performance

---

## Entity Relationship Diagram

```
organizations (1) ────< (many) user_profiles
organizations (1) ────< (many) customers
organizations (1) ────< (many) products
organizations (1) ────< (many) inventory
organizations (1) ────< (many) sales
organizations (1) ────< (many) payments
organizations (1) ────< (many) expenses

customers (1) ────< (many) sales
customers (1) ────< (many) payments

sales (1) ────< (many) sale_items
sales (1) ────< (many) payments [optional link]

products (1) ────< (many) sale_items
products (1) ────< (many) inventory

user_profiles (1) ────< (many) sales [created_by]
user_profiles (1) ────< (many) payments [created_by]
user_profiles (1) ────< (many) expenses [created_by]
```

---

## Tables

### 1. organizations
**Purpose**: Multi-tenant foundation - each organization is a separate business

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Business name |
| slug | TEXT | URL-friendly identifier (unique) |
| subscription_tier | ENUM | trial, free, basic, pro, enterprise |
| subscription_status | ENUM | trialing, active, past_due, cancelled, paused |
| trial_ends_at | TIMESTAMPTZ | When trial expires (MVP: extended indefinitely) |
| stripe_customer_id | TEXT | Phase 2: Stripe customer ID |
| stripe_subscription_id | TEXT | Phase 2: Stripe subscription ID |
| settings | JSONB | Feature flags, currency, tax rate, etc. |

**MVP Behavior**: All organizations default to `trial` tier with no enforcement.

---

### 2. user_profiles
**Purpose**: Extends Supabase Auth with business context

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK, FK to auth.users |
| organization_id | UUID | FK to organizations |
| email | TEXT | User email |
| full_name | TEXT | Display name |
| phone | TEXT | Contact number |
| role | ENUM | owner, admin, manager, employee |
| is_active | BOOLEAN | Can user log in? |

**Role Hierarchy**: owner > admin > manager > employee

---

### 3. customers
**Purpose**: Businesses/individuals who buy products on credit

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| customer_code | TEXT | Human-readable (CUST-0001) |
| name | TEXT | Customer name |
| business_name | TEXT | Optional business name |
| email | TEXT | Contact email |
| phone | TEXT | Contact phone |
| address | TEXT | Shipping/billing address |
| city | TEXT | City |
| credit_limit | DECIMAL(15,2) | Max debt allowed |
| current_balance | DECIMAL(15,2) | **Denormalized**: amount owed |
| notes | TEXT | Internal notes |
| is_active | BOOLEAN | Can still purchase? |

**Key Logic**: `current_balance` is automatically updated by triggers when sales/payments change.

---

### 4. products
**Purpose**: Product catalog - what the business sells

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| sku | TEXT | Stock Keeping Unit (unique) |
| name | TEXT | Product name |
| description | TEXT | Product details |
| category | TEXT | Simple text category |
| unit_of_measure | TEXT | unit, box, kg, etc. |
| cost_price | DECIMAL(15,2) | What business pays |
| sale_price | DECIMAL(15,2) | What customer pays |
| barcode | TEXT | **Phase 2**: for scanning |
| reorder_level | INTEGER | **Phase 2**: for alerts |
| is_active | BOOLEAN | Still selling this? |

**Profit Calculation**: `profit = sale_price - cost_price`

---

### 5. inventory
**Purpose**: Track stock levels (MVP: single location per org)

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| product_id | UUID | FK to products |
| quantity_on_hand | DECIMAL(15,3) | Current stock level |

**MVP Constraint**: One inventory record per product per organization (single location).

**Phase 2**: Add `warehouse_id` column for multi-warehouse support.

---

### 6. sales
**Purpose**: Sales transactions / invoices

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| sale_number | TEXT | Human-readable (INV-2024-0001) |
| customer_id | UUID | FK to customers |
| sale_date | DATE | When sale occurred |
| due_date | DATE | Payment deadline |
| status | ENUM | draft, completed, cancelled |
| subtotal | DECIMAL(15,2) | Sum of line items |
| tax | DECIMAL(15,2) | Tax amount |
| discount | DECIMAL(15,2) | Sale-level discount |
| total | DECIMAL(15,2) | subtotal + tax - discount |
| amount_paid | DECIMAL(15,2) | **Denormalized**: sum of payments |
| amount_due | DECIMAL(15,2) | total - amount_paid |
| payment_status | ENUM | unpaid, partial, paid |
| notes | TEXT | Internal notes |

**Key Logic**:
- `status = 'completed'` → inventory is reduced
- Totals updated automatically by triggers when sale_items change
- Payment status updated automatically when payments are recorded

---

### 7. sale_items
**Purpose**: Line items on invoices

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| sale_id | UUID | FK to sales (CASCADE delete) |
| product_id | UUID | FK to products |
| product_name | TEXT | **Snapshot**: name at sale time |
| quantity | DECIMAL(15,3) | Amount sold |
| unit_price | DECIMAL(15,2) | **Snapshot**: price at sale time |
| discount | DECIMAL(15,2) | Line-level discount |
| subtotal | DECIMAL(15,2) | (quantity × unit_price) - discount |

**Why Snapshots?**: Products can be renamed or repriced later. Invoices must show historical data.

---

### 8. payments
**Purpose**: Manual payment ledger - records money received in real world

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| payment_number | TEXT | Human-readable (PAY-2024-0001) |
| customer_id | UUID | FK to customers |
| sale_id | UUID | FK to sales (optional) |
| payment_date | DATE | When money was received |
| amount | DECIMAL(15,2) | Amount received |
| payment_method | ENUM | cash, card, bank_transfer, check, other |
| reference_number | TEXT | Check #, transaction ID, etc. |
| notes | TEXT | Internal notes |

**Key Features**:
- No Stripe, PayPal, or payment processing integration
- Employees manually record real-world payments
- Can be allocated to specific sale or unallocated (advance payment)
- Supports partial payments (multiple payments per sale)

**Example Workflow**:
1. Customer buys 5,000 KGS worth of goods
2. Pays 2,000 KGS cash today
3. Employee records payment: `amount = 2000, payment_method = 'cash'`
4. System calculates: `amount_due = 3,000 KGS`, `payment_status = 'partial'`
5. Customer pays remaining 3,000 KGS next week
6. Employee records second payment
7. System updates: `payment_status = 'paid'`, `current_balance = 0`

---

### 9. expenses
**Purpose**: Track business expenses

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| expense_number | TEXT | Human-readable (EXP-2024-0001) |
| expense_date | DATE | When expense occurred |
| category | TEXT | rent, utilities, supplies, etc. |
| vendor | TEXT | Who was paid |
| amount | DECIMAL(15,2) | Amount spent |
| payment_method | ENUM | cash, card, bank_transfer, check, other |
| description | TEXT | What was purchased |
| receipt_url | TEXT | Link to Supabase Storage |

**Phase 2**: Consider making `category` a separate table with predefined options.

---

## Business Logic (Triggers)

### 1. Update Sale Totals
**Trigger**: When sale_items are inserted/updated/deleted
**Action**: Recalculate `sales.subtotal`, `sales.total`, `sales.amount_due`

### 2. Update Customer Balance
**Trigger**: When sales status changes to 'completed'
**Action**: Recalculate `customers.current_balance` from all completed sales

### 3. Update Sale Payment Status
**Trigger**: When payments are inserted/updated/deleted
**Action**: 
- Update `sales.amount_paid` (sum of all payments)
- Update `sales.amount_due` (total - amount_paid)
- Update `sales.payment_status` (unpaid/partial/paid)

### 4. Update Inventory
**Trigger**: When sale status changes to 'completed'
**Action**: Reduce `inventory.quantity_on_hand` by sale_items quantities

---

## Security Model

### Row Level Security (RLS)

Every table has RLS policies that enforce:
1. Users can only access data from their own organization
2. Role-based permissions (RBAC)

**Helper Functions**:
- `auth.organization_id()` - returns current user's org
- `auth.user_role()` - returns current user's role

### Permission Matrix

| Action | Owner | Admin | Manager | Employee |
|--------|-------|-------|---------|----------|
| View all data | ✓ | ✓ | ✓ | ✓ |
| Manage users | ✓ | ✓ | ✗ | ✗ |
| Manage products | ✓ | ✓ | ✓ | view only |
| Manage customers | ✓ | ✓ | ✓ | ✓ |
| Create sales | ✓ | ✓ | ✓ | ✓ |
| Edit any sale | ✓ | ✓ | ✓ | own only |
| Record payments | ✓ | ✓ | ✓ | ✓ |
| Manage expenses | ✓ | ✓ | ✓ | ✗ |
| Manage inventory | ✓ | ✓ | ✓ | ✗ |
| Organization settings | ✓ | ✗ | ✗ | ✗ |

---

## MVP vs Phase 2 Comparison

| Feature | MVP (Phase 1) | Phase 2+ |
|---------|---------------|----------|
| Organizations | All on "trial" tier | Subscription tiers enforced |
| Billing | No billing logic | Stripe integration |
| Team members | Unlimited | Limits based on plan |
| Warehouses | Single location | Multi-warehouse support |
| Barcode | Field exists, unused | Scanning feature enabled |
| Reorder alerts | Field exists, unused | Low stock notifications |
| Invoice PDF | Not implemented | PDF generation + email |
| Payment processing | Manual ledger only | Keep manual (no Stripe for customer payments) |
| Reports | Basic queries | Advanced analytics, exports |
| Mobile app | Web only | React Native app |
| API | Internal only | Public API for integrations |

---

## Scalability Considerations

### Database Design Decisions

1. **Denormalized Balances**: `customers.current_balance` and `sales.amount_paid` are cached for performance. Triggers keep them in sync.

2. **JSONB Settings**: `organizations.settings` allows flexible configuration without schema migrations.

3. **Nullable Future Fields**: `products.barcode` and `products.reorder_level` exist but unused in MVP. Can enable later without migration.

4. **Subscription Foundation**: Stripe fields exist but unused. When adding billing, just populate these fields - no schema change needed.

5. **Soft Deletes**: `deleted_at` allows data recovery and audit trails.

6. **Indexed for Performance**: All FK columns and common query patterns have indexes.

### When to Optimize

**Current capacity**: ~10,000 sales/month per organization with acceptable performance.

**Optimization triggers**:
- Organizations > 1,000 
- Sales > 100,000 
- Query response time > 500ms
- Database size > 10GB

**Future optimizations**:
- Partition large tables by organization_id
- Add read replicas for reporting
- Cache frequently accessed data in Redis
- Archive old sales to separate table

---

## Development Workflow

### Local Development
1. Run Supabase locally: `supabase start`
2. Migrations auto-apply
3. Seed data loads demo organization

### Migration Strategy
- All schema changes via numbered SQL files
- Never edit previous migrations
- Test migrations on staging before production

### Type Safety
- Generate TypeScript types from schema: `npm run db:generate-types`
- Types automatically reflect database structure
- Full type safety from database to frontend

---

## Next Steps

**Phase 1 Implementation Order**:
1. ✅ Database schema created
2. ✅ RLS policies implemented
3. ⏳ Set up Supabase project
4. ⏳ Authentication flow
5. ⏳ Products module (CRUD)
6. ⏳ Customers module (CRUD)
7. ⏳ Sales module (create sale, add items, complete)
8. ⏳ Payments module (record payment, view history)
9. ⏳ Expenses module (CRUD)
10. ⏳ Basic reporting dashboard

**Estimated Timeline**: 8-10 weeks for MVP
