# Architecture Review — Principal Engineer Audit

**Reviewer:** Principal Software Engineer  
**Date:** 2024-07-23  
**Scope:** Complete system architecture, database design, business logic, security, performance  
**Severity Levels:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | 💡 Suggestion

---

## Executive Summary

**Overall Assessment:** The architecture is **well-designed for MVP** with strong fundamentals (multi-tenancy, RLS, repository pattern), but contains **significant over-engineering** for a pre-launch product and **several critical business logic gaps** that could cause production issues.

**Key Concerns:**
- 🔴 **Over-engineered for MVP** — Repository pattern + Service layer + Query builders is excessive before PMF
- 🔴 **Missing critical business rules** — No handling for payment conflicts, duplicate sales, concurrent edits
- 🟠 **Database trigger complexity** — Will be painful to debug in production
- 🟠 **No audit logging** — Cannot answer "who deleted this customer?" or "who changed this price?"
- 🟡 **JWT claims create sync issues** — Organization changes require manual session refresh

**Strengths:**
- ✅ Multi-tenant isolation via RLS is excellent
- ✅ Soft deletes everywhere (recoverable data)
- ✅ Feature-based organization scales well
- ✅ Comprehensive documentation

---

## 🔴 Critical Issues

### 1. Over-Engineering: Repository Pattern is Premature

**Issue:** Three-layer architecture (Service → Repository → Query Builders) before you have customers.

**Current:**
```typescript
// 3 layers for a simple query
Service → Repository Interface → Supabase Repository → Query Builder → Supabase
```

**Reality Check:**
- You have **zero paying customers**
- You don't know if the data model is right
- Switching databases is **not a real risk** (Supabase RLS is core to your security model)
- The "testability" benefit doesn't matter if you're not writing tests yet

**Evidence of Over-Engineering:**
```
Each feature needs:
- types.ts (reasonable)
- validation.ts (reasonable)
- business-rules.ts (reasonable)
- queries.ts (⚠️  indirection for no benefit)
- repository.ts (⚠️  interface you'll never swap)
- service.ts (⚠️  thin wrapper)
- hooks.ts (reasonable)

= 7 files per feature × 9 features = 63 files before any UI exists
```

**Real Cost:**
- **3-4 weeks of development time** spent on abstractions instead of talking to customers
- Harder onboarding (new devs must learn 3 layers before contributing)
- False sense of "replaceability" (you're locked into Supabase RLS anyway)

**Recommendation:**
```typescript
// For MVP: Server Components call Supabase directly
export default async function CustomersPage() {
  const user = await getServerUser()
  const supabase = await createServerClient()
  
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .eq('organization_id', user.organizationId)
  
  return <CustomerList customers={customers} />
}
```

**When to add layers:**
- When you have 10+ paying customers and understand the domain deeply
- When you're actually writing tests (not "we should write tests")
- When you need to swap implementations (rare)

**Keep:**
- `types.ts` — type safety is cheap
- `validation.ts` — protects database integrity
- `business-rules.ts` — pure functions, easy to test

**Delete:**
- `queries.ts` — just write Supabase queries inline
- `repository.ts` — YAGNI (You Ain't Gonna Need It)
- `service.ts` — move logic to Server Actions directly

---

### 2. Missing Business Rule: Concurrent Sale Edits

**Issue:** Two employees can edit the same draft sale simultaneously. Last write wins, no conflict detection.

**Scenario:**
```
T1: Employee A opens Sale #123 (5 items, total: 1000)
T2: Employee B opens Sale #123 (same data)
T3: Employee A adds item → total: 1200 → saves
T4: Employee B removes item → total: 800 → saves
Result: Employee A's addition is silently lost
```

**No optimistic locking, no version field, no "modified since you loaded" check.**

**Recommendation:**

**Option 1: Optimistic Locking (Best)**
```sql
ALTER TABLE sales ADD COLUMN version INTEGER DEFAULT 1;

CREATE TRIGGER trg_increment_sales_version
BEFORE UPDATE ON sales
FOR EACH ROW
EXECUTE FUNCTION increment_version();
```

```typescript
// In update action
const result = await supabase
  .from('sales')
  .update({ ...changes, version: currentVersion + 1 })
  .eq('id', saleId)
  .eq('version', currentVersion)  // ← Fails if version changed

if (result.count === 0) {
  return { 
    success: false, 
    error: 'Sale was modified by someone else. Please refresh.' 
  }
}
```

**Option 2: Last-Modified Check (Simpler)**
```typescript
// Client sends updated_at timestamp it loaded
if (sale.updated_at !== clientUpdatedAt) {
  return { error: 'Sale was modified. Refresh and try again.' }
}
```

**Option 3: Real-Time Indicators (UX)**
- Show "Employee B is editing this sale" when multiple users have it open
- Use Supabase Realtime to broadcast presence

**Cost:** 1 day. **Risk if skipped:** Data loss, customer complaints.

---

### 3. Missing Business Rule: Duplicate Payment Detection

**Issue:** Nothing prevents recording the same payment twice.

**Scenario:**
```
Customer hands over 5000 KGS cash.
Employee A records it.
Employee B (didn't see) also records it.
Result: Customer credited 10,000 KGS, owes nothing, keeps the goods.
```

**No uniqueness constraint on:**
- `(customer_id, payment_date, amount)` ← Same customer, same day, same amount
- `reference_number` ← Check #1234 recorded twice

**Recommendation:**

**Add unique constraint on reference_number:**
```sql
ALTER TABLE payments 
ADD CONSTRAINT payments_reference_unique 
UNIQUE (organization_id, reference_number) 
WHERE reference_number IS NOT NULL AND deleted_at IS NULL;
```

**Add duplicate detection in service layer:**
```typescript
// Before creating payment
const existing = await supabase
  .from('payments')
  .select('id')
  .eq('customer_id', customerId)
  .eq('payment_date', paymentDate)
  .eq('amount', amount)
  .gte('created_at', dayStart)  // Within same day
  .lte('created_at', dayEnd)

if (existing.data?.length > 0) {
  return {
    success: false,
    error: 'A payment for this amount was already recorded today. Duplicate?',
    isSoftWarning: true  // Manager can override
  }
}
```

**Cost:** 2 hours. **Risk if skipped:** Financial loss.

---

### 4. Missing Business Rule: Sale Number Gaps

**Issue:** Sale numbers are sequential (`INV-2024-0001`), but if a draft is deleted, the number is lost forever.

**Current implementation (assumed):**
```typescript
const nextNumber = (await getMaxSaleNumber()) + 1
```

**Problem:**
```
Create draft INV-2024-0001 → Delete it
Create new sale → INV-2024-0002 (0001 is lost forever)
```

**Auditors/tax authorities may flag missing numbers as suspicious.**

**Recommendation:**

**Option 1: Never delete drafts (Soft delete only)**
```sql
-- Sales are never hard-deleted
-- drafted sales with deleted_at still keep their number
```

**Option 2: Reuse gaps**
```typescript
// Find smallest available number
const gaps = await supabase.rpc('find_sale_number_gaps', { org_id })
const nextNumber = gaps[0] || (maxNumber + 1)
```

**Option 3: Separate draft numbering**
```
Drafts: DRAFT-0001, DRAFT-0002
Completed: INV-2024-0001, INV-2024-0002
```
Only assign final number on completion (no gaps).

**Preferred:** Option 3 (cleanest).

---

### 5. Security: JWT Claims Stale After Role Change

**Issue:** User's role is embedded in JWT `app_metadata.role`. If admin changes their role, JWT doesn't update until they log out/in.

**Attack Scenario:**
```
T1: User is 'employee'
T2: Admin promotes to 'manager'
T3: Admin client updates:
    - user_profiles.role = 'manager'
    - auth.users.app_metadata.role = 'manager'
T4: User still has old JWT with role='employee'
T5: User's session (1 hour) continues with employee permissions
```

**Worse:** If admin *demotes* a user, they keep elevated access for up to 1 hour.

**Recommendation:**

**Option 1: Force Logout on Role Change**
```typescript
// After updating role
await supabaseAdmin.auth.admin.signOut(userId)  // Invalidate all sessions
// User must log in again → gets new JWT
```

**Option 2: Shorter JWT TTL**
```
Current: 1 hour access token
Proposed: 5 minutes access token (refresh token still 30 days)
```
Role changes take effect within 5 minutes.

**Option 3: Always Query DB for Role (Safest)**
```sql
-- Don't trust JWT claims for authorization
CREATE FUNCTION auth.user_role() RETURNS user_role AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid()
  -- Ignore JWT, always query fresh
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

**Trade-off:**
- Option 1: Best UX (immediate), but disruptive
- Option 2: Balanced
- Option 3: Safest, but slower (extra query per RLS check)

**Preferred:** Option 1 (force logout) + notify user "Your role changed, please log in again."

---

## 🟠 High Priority Issues

### 6. Performance: Denormalized Fields Create Trigger Hell

**Issue:** `sales.subtotal`, `sales.total`, `sales.amount_paid`, `customers.current_balance` are denormalized (recalculated by triggers).

**Triggers needed:**
- `sale_items` INSERT/UPDATE/DELETE → recalc `sales.subtotal`, `sales.total`
- `payments` INSERT/DELETE → recalc `sales.amount_paid`, `sales.payment_status`
- `sales` status change → recalc `customers.current_balance`
- `payments` INSERT/DELETE → recalc `customers.current_balance`

**Result:** 4-5 triggers, each one a potential bug source.

**Real Production Story:**
> "Customer says they paid 5000, dashboard shows 0. Turned out a trigger failed silently 3 days ago. Took 6 hours to debug because triggers don't log errors."

**Current Complexity:**
```sql
-- Trigger fires → calls function → updates related table
-- If function errors → transaction rolls back, but why?
-- No stack trace, no logs, silent failure
```

**Recommendation:**

**For MVP: Don't denormalize. Calculate on read.**

```typescript
// Before (denormalized):
const sale = await supabase.from('sales').select('amount_paid').single()
console.log(sale.amount_paid)  // Trigger-maintained

// After (calculated):
const { data: payments } = await supabase
  .from('payments')
  .select('amount')
  .eq('sale_id', saleId)

const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0)
```

**When to denormalize:**
- When you have 100k+ sales and queries are measurably slow
- After you have monitoring/observability for triggers
- After you've written tests for trigger logic

**Cost of premature denormalization:**
- 3-4 days building/testing triggers
- 1-2 days/month debugging trigger issues
- Risk of silent data corruption

**Cost of calculating on read:**
- ~50ms extra per query (negligible at MVP scale)

**Verdict:** **Remove denormalization for MVP. Add it back in Phase 2 if performance actually suffers.**

---

### 7. Missing: Audit Logging

**Issue:** No audit trail. Cannot answer:
- "Who deleted customer #123?"
- "Who changed the price of Product X from 100 to 150?"
- "Who marked Sale #456 as cancelled?"

**Current:**
- `created_by` exists (good)
- `updated_at` exists (good)
- `deleted_at` exists (good)
- **`updated_by`** missing (bad)
- **`deleted_by`** missing (bad)
- **No audit log table** (bad)

**Recommendation:**

**Phase 1: Add updated_by and deleted_by**
```sql
ALTER TABLE customers ADD COLUMN updated_by UUID REFERENCES user_profiles(id);
ALTER TABLE customers ADD COLUMN deleted_by UUID REFERENCES user_profiles(id);
-- Repeat for all tables
```

**Phase 2: Audit Log Table**
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE'
  changed_fields JSONB,  -- { "price": { "old": 100, "new": 150 } }
  changed_by UUID REFERENCES user_profiles(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_user ON audit_log(changed_by);
```

**Trigger to populate:**
```sql
CREATE TRIGGER trg_audit_customers
AFTER UPDATE OR DELETE ON customers
FOR EACH ROW
EXECUTE FUNCTION log_audit_trail();
```

**Cost:** 2 days for basic `updated_by`, 1 week for full audit log.

**When:** Add `updated_by`/`deleted_by` in MVP. Full audit log in Phase 2 (unless compliance required).

---

### 8. Performance: Missing Index on Frequent Queries

**Issue:** Some likely queries are not indexed.

**Missing indexes:**

```sql
-- Overdue sales query (likely frequent)
CREATE INDEX idx_sales_overdue 
ON sales(due_date, payment_status) 
WHERE status = 'completed' AND payment_status IN ('unpaid', 'partial');

-- Customer search by phone (likely frequent)
CREATE INDEX idx_customers_phone 
ON customers USING gin(phone gin_trgm_ops);  -- Fuzzy search

-- Product search by name
CREATE INDEX idx_products_name_trgm 
ON products USING gin(name gin_trgm_ops);

-- Sale items by product (for "product sales history")
CREATE INDEX idx_sale_items_product_date 
ON sale_items(product_id, created_at DESC);

-- Payments by date range (for reports)
CREATE INDEX idx_payments_date_range 
ON payments(organization_id, payment_date DESC);
```

**Cost:** 1 hour. **Benefit:** 10-100x faster queries.

---

### 9. Business Logic: Draft Sale Timeout Missing

**Issue:** Drafts can sit forever. Employee starts a sale on Monday, never completes it, it sits in draft list forever.

**Real Problem:**
- Draft list cluttered with abandoned sales
- "Did I create this already?" confusion
- Inventory not affected, but mental model says stock is "reserved"

**Recommendation:**

**Add draft expiration:**
```sql
-- Flag drafts older than 7 days
SELECT * FROM sales 
WHERE status = 'draft' 
  AND created_at < NOW() - INTERVAL '7 days';
```

**Auto-delete or auto-archive:**
```sql
-- Cron job (daily)
UPDATE sales 
SET deleted_at = NOW() 
WHERE status = 'draft' 
  AND created_at < NOW() - INTERVAL '30 days';
```

**Or:** Show warning in UI: "⚠️  Draft from 8 days ago. Complete or delete?"

**Cost:** 2 hours.

---

## 🟡 Medium Priority Issues

### 10. Database: payment_method Enum Should Be Flexible

**Issue:** `payment_method` is an enum: `'cash' | 'card' | 'bank_transfer' | 'check' | 'other'`.

**Problem:**
- What if Kyrgyzstan customer pays via KICB bank transfer?
- What if customer pays via mobile money (M-Pesa, Elsom)?
- Adding enum values requires a migration

**Current:**
```sql
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'bank_transfer', 'check', 'other');
```

**Recommendation:**

**Change to TEXT with a CHECK constraint:**
```sql
ALTER TABLE payments ALTER COLUMN payment_method TYPE TEXT;

-- Still validate, but easier to add new methods
ALTER TABLE payments 
ADD CONSTRAINT payment_method_valid 
CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'check', 'mobile_money', 'other'));
```

**Or:** Make it free text, suggest common values in UI dropdown.

**Cost:** 30 minutes.

---

### 11. Naming: Inconsistent Pluralization

**Issue:** Some tables plural, some singular concepts mixed.

**Inconsistencies:**
- Table: `customers` (plural) ← Good
- Table: `products` (plural) ← Good
- Table: `inventory` (singular concept, but table of rows) ← Confusing
- Column: `sale_items.sale_id` (singular) ← Good
- Type: `Sale` (singular) ← Good
- Repository: `CustomerRepository` (singular entity) ← Good

**Actually consistent.** No issue here.

---

### 12. Business Logic: No Maximum Line Items Per Sale

**Issue:** Nothing stops a sale from having 10,000 line items (accidental or malicious).

**Risk:**
- UI breaks trying to render
- Triggers timeout recalculating totals
- Database bloat

**Recommendation:**

**Add constraint:**
```sql
-- Limit to 500 items per sale (reasonable for wholesale)
CREATE FUNCTION check_sale_items_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM sale_items WHERE sale_id = NEW.sale_id) > 500 THEN
    RAISE EXCEPTION 'A sale cannot have more than 500 items';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sale_items_limit
BEFORE INSERT ON sale_items
FOR EACH ROW
EXECUTE FUNCTION check_sale_items_limit();
```

**Cost:** 30 minutes.

---

### 13. Security: No Rate Limiting on Server Actions

**Issue:** Documented in API.md as "Phase 2", but should be MVP.

**Attack:**
```javascript
// Malicious script
while (true) {
  await createCustomerAction({ name: 'Spam', phone: '000' })
}
```

**Result:** Database fills with garbage, costs spike.

**Recommendation:**

**Add Vercel rate limiting (free tier: 100 req/10s):**
```typescript
// middleware.ts
import { rateLimit } from '@/lib/rate-limit'

export async function middleware(req: NextRequest) {
  const ip = req.ip ?? '127.0.0.1'
  const { success } = await rateLimit(ip)
  
  if (!success) {
    return new Response('Rate limit exceeded', { status: 429 })
  }
  
  // ... rest of middleware
}
```

**Cost:** 2 hours. **Risk if skipped:** DOS attack, runaway costs.

---

### 14. Performance: N+1 Query in Sale Detail

**Issue:** Loading sale with items and payments likely does 3 queries:

```typescript
// Query 1: Get sale
const sale = await supabase.from('sales').select('*').eq('id', id).single()

// Query 2: Get items
const items = await supabase.from('sale_items').select('*').eq('sale_id', id)

// Query 3: Get payments
const payments = await supabase.from('payments').select('*').eq('sale_id', id)
```

**Should be 1 query:**
```typescript
const { data } = await supabase
  .from('sales')
  .select(`
    *,
    items:sale_items(*),
    payments:payments(*)
  `)
  .eq('id', id)
  .single()
```

**Supabase supports nested selects.** Use them.

**Cost:** Review all queries, fix N+1s. 4 hours.

---

## 🟢 Low Priority / Nitpicks

### 15. Naming: `user_profiles` vs `users`

**Issue:** Table is called `user_profiles` (2 words), but everywhere else you say "user".

**Confusing:**
```typescript
import { User } from '@/features/users/types'
// But database table is user_profiles?
```

**Recommendation:** Rename table to `users` (breaking change, but MVP so no data loss).

**Or:** Leave it. Supabase convention is `user_profiles` (their terminology). Not worth changing.

---

### 16. Over-Normalization: `sale_items` Duplicates product_name

**Issue:** `sale_items.product_name` is a snapshot, but so is `unit_price` and `cost_price`. Why snapshot name but not `sku`?

**Current:**
```sql
sale_items:
  product_name TEXT  -- Snapshot
  unit_price DECIMAL -- Snapshot
  cost_price DECIMAL -- Snapshot
  -- sku missing (not snapshot)
```

**If product is renamed after sale, invoice shows new name (snapshot).  
If product's SKU changes after sale, invoice breaks (no snapshot).**

**Recommendation:**

**Add `product_sku` snapshot:**
```sql
ALTER TABLE sale_items ADD COLUMN product_sku TEXT;
```

**Update sale item creation:**
```typescript
{
  product_sku: product.sku,  // ← Add
  product_name: product.name,
  unit_price: product.sale_price,
  cost_price: product.cost_price,
}
```

**Cost:** 1 hour.

---

### 17. Business Logic: Negative Discounts Allowed

**Issue:** Nothing stops `discount = -50` (negative discount = surcharge).

**Is this intentional?**
- Negative discount = fee (delivery, handling, etc.)
- Or should fees be a separate line item?

**Recommendation:**

**If unintentional:**
```sql
ALTER TABLE sale_items 
ADD CONSTRAINT discount_non_negative 
CHECK (discount >= 0);
```

**If intentional (fees):**
- Rename to `adjustment` (can be + or −)
- Or add separate `fees` column

**Cost:** 15 minutes.

---

## 🎯 Scalability Concerns

### 18. Single Postgres Instance Bottleneck

**Current:** Supabase free tier = 1 Postgres instance, no replicas.

**Limit:** ~500 concurrent connections, ~10k req/sec.

**Breaking Point:**
- 1000 active organizations × 10 users each = 10k users
- If 10% online simultaneously = 1k concurrent
- Each user queries DB every 2 seconds = 500 req/sec
- **You'll hit limits around 500-1000 organizations.**

**Recommendation:**

**Phase 1 (MVP):** Don't worry. You need 100 customers first.

**Phase 2 (If successful):**
- Upgrade to Supabase Pro ($25/mo) → 2x capacity
- Add read replicas for reporting queries
- Use Supabase connection pooling (PgBouncer)

**Phase 3 (If scaling to 10k+ orgs):**
- Shard by `organization_id` (each shard = 1k orgs)
- Or migrate to managed Postgres (AWS RDS, GCP Cloud SQL) with larger instance

**Not a concern now.** Document in ROADMAP.md.

---

### 19. File Uploads (Receipts) Not Designed

**Issue:** `expenses.receipt_url` exists, but no upload flow designed.

**Questions:**
- Where stored? (Supabase Storage? S3?)
- Size limits? (1MB? 10MB?)
- File types? (JPEG, PDF, PNG?)
- RLS policies on storage buckets?

**Recommendation:**

**Defer to Phase 2** (receipts are nice-to-have, not MVP-critical).

**When implementing:**
```typescript
// Supabase Storage bucket with RLS
CREATE POLICY "Users upload receipts to own org"
ON storage.objects FOR INSERT
USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.organization_id()::TEXT);
```

---

## 💡 Suggestions (Non-Blocking)

### 20. Consider: Event Sourcing for Sales

**Idea:** Instead of updating `sales.status` in place, append events:

```sql
CREATE TABLE sale_events (
  id UUID PRIMARY KEY,
  sale_id UUID NOT NULL,
  event_type TEXT NOT NULL,  -- 'created', 'item_added', 'completed', 'cancelled'
  event_data JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Benefits:**
- Full audit trail (who did what when)
- Can replay events (rebuild state)
- No "modified by someone else" conflicts (append-only)

**Drawbacks:**
- More complex queries (latest state = reduce all events)
- Overkill for MVP

**Verdict:** Interesting for Phase 3. Not now.

---

### 21. Consider: CQRS for Reports

**Idea:** Separate read models from write models.

**Write model:** Normalized tables (current design)  
**Read model:** Denormalized views (for reports)

```sql
-- Materialized view for dashboard
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT 
  organization_id,
  SUM(total) AS revenue_this_month,
  COUNT(*) AS sales_count,
  ...
FROM sales
WHERE sale_date >= date_trunc('month', CURRENT_DATE)
GROUP BY organization_id;

-- Refresh every 5 minutes
REFRESH MATERIALIZED VIEW dashboard_stats;
```

**Benefits:**
- Fast dashboard (no aggregation at query time)
- Write model stays simple

**Drawbacks:**
- Stale data (5 min lag)
- More complexity

**Verdict:** Good idea for Phase 2 if dashboard is slow.

---

### 22. Consider: Soft Delete Should Have Reason

**Idea:** Track *why* something was deleted.

```sql
ALTER TABLE customers ADD COLUMN deleted_reason TEXT;
ALTER TABLE customers ADD CONSTRAINT deleted_reason_required 
CHECK ((deleted_at IS NULL) = (deleted_reason IS NULL));
```

**Example reasons:**
- "Duplicate entry"
- "Customer requested data deletion (GDPR)"
- "Inactive for 2 years"
- "Spam"

**Benefits:** Better audit trail.

**Cost:** 1 hour.

**Verdict:** Nice to have, not critical.

---

## Summary & Prioritized Recommendations

### 🔴 Fix Before Launch (Critical)

| # | Issue | Impact | Effort | Priority |
|---|-------|--------|--------|----------|
| 1 | **Remove over-engineering** (repository pattern) | 3-4 weeks saved | 1 week refactor | **DO IT** |
| 2 | **Add concurrent edit detection** | Data loss prevention | 1 day | **DO IT** |
| 3 | **Add duplicate payment detection** | Financial loss prevention | 2 hours | **DO IT** |
| 5 | **Fix JWT claims staleness** | Security (role escalation) | 4 hours | **DO IT** |
| 13 | **Add rate limiting** | DOS prevention | 2 hours | **DO IT** |

**Total Effort:** ~2 weeks. **Saved Time:** 3-4 weeks. **Net Gain:** 1-2 weeks.

---

### 🟠 Fix Within 2 Weeks of Launch (High)

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 4 | Sale number gaps | Audit/tax issues | 1 day |
| 6 | Remove denormalization | Debugging hell | 3 days |
| 7 | Add updated_by/deleted_by | Audit trail | 2 days |
| 8 | Add missing indexes | Performance (10-100x) | 1 hour |

**Total Effort:** ~1 week.

---

### 🟡 Fix in Phase 2 (Medium)

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 9 | Draft sale timeouts | UX (clutter) | 2 hours |
| 10 | payment_method flexibility | Future-proofing | 30 min |
| 12 | Max line items limit | DoS protection | 30 min |
| 14 | Fix N+1 queries | Performance | 4 hours |
| 16 | Add product_sku snapshot | Invoice integrity | 1 hour |

**Total Effort:** 1 day.

---

### 🟢 Optional (Low Priority)

- Negative discounts constraint
- Soft delete reasons
- Event sourcing (Phase 3)
- CQRS read models (Phase 3)

---

## Final Verdict

**The architecture is 80% excellent, 20% over-engineered.**

**Do this immediately:**
1. ✂️  **Simplify:** Remove repository pattern for MVP (save 3 weeks)
2. 🔒 **Secure:** Fix JWT staleness + add rate limiting (4 hours)
3. 🛡️  **Protect:** Add concurrent edit detection + duplicate payment check (1 day)

**Then launch and get customers.**

**After 10 paying customers:**
- Add back layers if needed (probably not)
- Add full audit logging
- Optimize performance (indexes, denormalization if proven slow)

**The biggest risk is not technical—it's building abstractions before validating the product-market fit.**
