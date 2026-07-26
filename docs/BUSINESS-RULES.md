# Business Rules & Domain Logic

## Overview

Business rules are the **core domain logic** that makes this application specific to wholesale businesses. They encode constraints, calculations, and validations that protect business interests.

**Organization:** Rules are organized by domain (`customers/`, `products/`, `sales/`, etc.) in pure TypeScript functions with **no side effects**. This makes them easy to test and reuse.

---

## Credit Management (Customers)

### Rule: Credit Limit Enforcement

**Statement:** A customer's total debt cannot exceed their credit limit.

**Formula:**
```typescript
available_credit = credit_limit - current_balance
can_sell = new_sale_total <= available_credit
```

**Implementation:**
```typescript
// customers/business-rules.ts
export function isWithinCreditLimit(
  customer: Customer, 
  additionalAmount: Money
): boolean {
  if (customer.credit_limit === null) return true  // No limit
  return customer.current_balance + additionalAmount <= customer.credit_limit
}
```

**Enforcement:**
- **Application layer:** Pre-flight check before completing sale (user-friendly error)
- **Database:** No constraint (intentional — managers can override)

**Soft vs Hard:**
- **Soft warning:** Shows "Credit limit exceeded" but allows manager override
- **Why soft?** Trusted customers may temporarily exceed limits
- **Future:** Add `allow_credit_override` permission flag

---

### Rule: Active Customer Check

**Statement:** Cannot create sales for inactive customers.

**Rationale:** Inactive customers are those who:
- Haven't paid in months (credit risk)
- Business closed
- Marked inactive by manager

**Implementation:**
```typescript
export function checkCreditForSale(
  customer: Customer,
  saleTotal: Money
): Result<void, { message: string; isSoftWarning: boolean }> {
  if (!customer.is_active) {
    return {
      success: false,
      error: {
        message: `Customer "${customer.name}" is inactive. Reactivate before creating sales.`,
        isSoftWarning: false  // Hard block
      }
    }
  }
  // Check credit limit...
}
```

**Enforcement:** Application layer (hard block)

---

### Rule: Customer Balance Calculation

**Statement:** Customer balance = total debt - total payments.

**Formula:**
```typescript
current_balance = 
  SUM(completed_sales.amount_due WHERE customer_id = X)
  - SUM(unallocated_payments.amount WHERE customer_id = X)
```

**Why unallocated payments?**
- Allocated payments already reduce `sale.amount_due`
- Unallocated payments are advance credits

**Implementation:** Database trigger recalculates on every sale/payment change.

**Example:**
```
Customer ABC:
  Sale #1: 1000 KGS (completed, unpaid) → balance: +1000
  Payment #1: 300 KGS (to Sale #1) → Sale #1 now 700 due, balance: +700
  Payment #2: 200 KGS (unallocated) → balance: +700 - 200 = 500
  Sale #2: 500 KGS (completed, unpaid) → balance: 500 + 500 = 1000
```

---

### Rule: Customer Code Generation

**Statement:** Customer codes follow format `CUST-NNNN` with sequential numbering.

**Examples:**
- `CUST-0001`, `CUST-0042`, `CUST-1000`

**Implementation:**
```typescript
export function generateCustomerCode(sequenceNumber: number): string {
  return `CUST-${String(sequenceNumber).padStart(4, '0')}`
}
```

**Uniqueness:** Enforced by database unique constraint on `(organization_id, customer_code)`.

---

## Pricing & Profit (Products)

### Rule: Sale Price Must Cover Cost

**Statement:** Sale price should be ≥ cost price (don't sell at a loss).

**Implementation:**
```typescript
export function isPricingHealthy(product: Product): Result<void> {
  if (product.sale_price < product.cost_price) {
    const loss = product.cost_price - product.sale_price
    return {
      success: false,
      error: `Selling price is ${loss.toFixed(2)} below cost. Selling at a loss.`
    }
  }
  return { success: true, data: undefined }
}
```

**Enforcement:**
- Database: CHECK constraint `sale_price >= cost_price` (blocks)
- Application: Validation with warning (can be overridden)

**Why allow override?** Clearance sales, promotional pricing, loss leaders.

---

### Rule: Profit Calculation

**Gross Profit (Unit):**
```typescript
export function calculateProfitPerUnit(product: Product): Money {
  return product.sale_price - product.cost_price
}
```

**Gross Margin (%):**
```typescript
export function calculateMarginPercent(product: Product): number {
  if (product.sale_price === 0) return 0
  return ((product.sale_price - product.cost_price) / product.sale_price) * 100
}
```

**Markup (%):**
```typescript
export function calculateMarkupPercent(product: Product): number {
  if (product.cost_price === 0) return 0
  return ((product.sale_price - product.cost_price) / product.cost_price) * 100
}
```

**Difference:**
- **Margin:** Profit as % of selling price (what customer pays)
- **Markup:** Profit as % of cost price (what business pays)

**Example:**
```
Cost: 100 KGS, Sale: 150 KGS
Profit: 50 KGS
Margin: 50/150 = 33.3%
Markup: 50/100 = 50%
```

---

### Rule: Historical Profit Uses Snapshot Cost

**Statement:** Profit for past sales must use the cost price at the time of sale, not current cost.

**Why:** Costs change over time. Without snapshots, profit reports become inaccurate.

**Implementation:**
```sql
-- sale_items table stores snapshot
CREATE TABLE sale_items (
  ...
  cost_price DECIMAL(15,2) NOT NULL,  -- Snapshot from products.cost_price
  ...
);
```

```typescript
// When creating sale item
const saleItem = {
  product_id: product.id,
  cost_price: product.cost_price,  // Snapshot captured here
  unit_price: product.sale_price,
  ...
}
```

**Profit calculation:**
```typescript
export function calculateItemGrossProfit(item: SaleItem): Money {
  const revenuePerUnit = item.unit_price - item.discount / item.quantity
  return (revenuePerUnit - item.cost_price) * item.quantity
}
```

Uses `item.cost_price` (snapshot), not `product.cost_price` (current).

---

## Inventory Rules

### Rule: No Negative Stock

**Statement:** `quantity_on_hand` cannot go below zero.

**Rationale:** Cannot sell what you don't have. Negative stock is meaningless.

**Enforcement:**
- Database: `CHECK (quantity_on_hand >= 0)`
- Application: Pre-flight check before sale completion

**Consequence:** Sale completion fails if inventory insufficient.

---

### Rule: Drafts Don't Reserve Stock

**Statement:** A sale in `draft` status does not decrease inventory.

**Rationale:** Wholesale drafts may sit for hours/days. Reserving stock creates phantom shortages.

**Consequence:** **Race condition possible**. Two employees can draft the same stock. First to complete wins.

**Example:**
```
T1: Employee A creates draft for 50 units (inventory: 100)
T2: Employee B creates draft for 60 units (inventory: 100)
T3: Employee A completes → inventory: 50
T4: Employee B tries to complete → ERROR: "Insufficient stock"
```

**This is correct behavior.** Alternative (Phase 2): add inventory reservation system.

---

### Rule: Inventory Adjustment Reasons

**Statement:** Every manual adjustment must have a reason.

**Reasons:**
- `initial_stock` — First-time setup
- `purchase` — Received from supplier
- `return` — Customer returned goods
- `damage` — Goods damaged/expired
- `loss` — Lost or stolen
- `count_correction` — Physical count discrepancy
- `other` — Requires explanation in notes

**Enforcement:** Application validation (not database constraint for flexibility).

**Audit:** Future Phase 2: `inventory_audit_log` table tracks every adjustment.

---

### Rule: Low Stock Detection

**Statement:** Product is "low stock" when `quantity_on_hand ≤ reorder_level`.

**Implementation:**
```typescript
export function isLowStock(
  inventory: Inventory, 
  reorderLevel: number | null
): boolean {
  if (reorderLevel === null) return false  // No threshold set
  return inventory.quantity_on_hand <= reorderLevel
}
```

**Action:** Dashboard shows low stock count. Inventory page highlights products.

**Future:** Email/SMS alerts when stock falls below threshold.

---

## Sales Workflow Rules

### Rule: Sale Completion Validation

**Statement:** A sale can only transition `draft` → `completed` if:
1. Has at least one item
2. Customer is active
3. Inventory sufficient for all products
4. Credit limit not exceeded (soft warning)

**Implementation:**
```typescript
export function canCompleteSale(
  sale: Sale,
  items: SaleItem[],
  customer: Customer,
  inventoryMap: Map<ProductId, Inventory>
): Result<void> {
  if (items.length === 0) {
    return fail("Sale must have at least one item")
  }
  
  if (!customer.is_active) {
    return fail("Customer is inactive")
  }
  
  for (const item of items) {
    const inventory = inventoryMap.get(item.product_id)
    if (!inventory || inventory.quantity_on_hand < item.quantity) {
      return fail(`Insufficient stock for ${item.product_name}`)
    }
  }
  
  if (!isWithinCreditLimit(customer, sale.total)) {
    return warn("Credit limit exceeded")  // Soft warning
  }
  
  return success()
}
```

---

### Rule: Sale Total Calculation

**Statement:** Sale total follows a specific formula.

**Formula:**
```
item_subtotal = (quantity × unit_price) - line_discount
sale_subtotal = SUM(item_subtotals)
sale_total = sale_subtotal + tax - sale_discount
amount_due = sale_total - amount_paid
```

**Implementation:**
```typescript
export function calculateSaleTotals(
  items: SaleItem[],
  tax: Money,
  saleDiscount: Money
): { subtotal: Money; total: Money } {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  const total = subtotal + tax - saleDiscount
  return { subtotal, total }
}
```

**Maintained by:** Database trigger recalculates whenever items change.

---

### Rule: Payment Status Derivation

**Statement:** Payment status is derived from `amount_paid` vs `total`.

**Logic:**
```typescript
export function getSalePaymentStatus(
  total: Money, 
  amountPaid: Money
): PaymentStatus {
  const amountDue = total - amountPaid
  if (amountDue <= 0) return 'paid'
  if (amountPaid > 0) return 'partial'
  return 'unpaid'
}
```

**Maintained by:** Database trigger updates whenever payments change.

**Edge case:** `amount_paid > total` (overpayment) → status is `'paid'`, excess goes to customer credit.

---

### Rule: Sale Cancellation

**Statement:** A completed sale can be cancelled to reverse it.

**Validations:**
```typescript
export function canCancelSale(sale: Sale): Result<void> {
  if (sale.status === 'draft') {
    return fail("Delete draft sales, don't cancel them")
  }
  
  if (sale.status === 'cancelled') {
    return fail("Sale is already cancelled")
  }
  
  if (sale.amount_paid > 0) {
    return warn(`Sale has payments (${sale.amount_paid}). Refund separately.`)
  }
  
  return success()
}
```

**Effects:**
- Inventory restored (automatic trigger)
- Customer debt removed (automatic trigger)
- Payments NOT reversed (manual action)

**Why not auto-refund?** Manager must confirm refund with customer first.

---

### Rule: Overdue Detection

**Statement:** A sale is overdue if:
- Has a `due_date` set
- `due_date < today`
- `payment_status` is `'unpaid'` or `'partial'`

**Implementation:**
```typescript
export function isOverdue(sale: Sale): boolean {
  if (!sale.due_date) return false
  if (sale.payment_status === 'paid') return false
  return sale.due_date < new Date()
}
```

**Used in:** Overdue sales report, customer account statement.

---

## Payment Rules

### Rule: Payment Amount Validation

**Statement:** Payment amount must be positive and not exceed what's owed (soft warning on excess).

**Implementation:**
```typescript
export function canRecordPayment(
  input: { amount: Money },
  customer: Customer,
  sale: Sale | null
): Result<void> {
  if (input.amount <= 0) {
    return fail("Payment must be greater than zero")
  }
  
  if (!customer.is_active) {
    return fail("Customer is inactive")
  }
  
  if (sale && input.amount > sale.amount_due) {
    return warn(
      `Payment (${input.amount}) exceeds amount due (${sale.amount_due}). 
       Excess will create account credit.`
    )
  }
  
  return success()
}
```

**Enforcement:** Application validation.

---

### Rule: Unallocated Payments

**Statement:** Payments can be recorded without specifying a sale (`sale_id = NULL`).

**Use cases:**
- Advance payment (customer pays before taking goods)
- Account credit (goodwill, returned goods credit)
- Payment toward overall debt (not specific invoice)

**Effect:** Reduces `customer.current_balance` but not linked to specific sale.

---

## User Role Rules

### Rule: Role Hierarchy

**Statement:** Roles form a hierarchy. Higher roles can do everything lower roles can.

```
owner (4) > admin (3) > manager (2) > employee (1)
```

**Implementation:**
```typescript
const ROLE_LEVEL: Record<UserRole, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  employee: 1,
}

export function hasRole(user: AuthUser, minimumRole: UserRole): boolean {
  return ROLE_LEVEL[user.role] >= ROLE_LEVEL[minimumRole]
}
```

**Permission matrix:**

| Action | Owner | Admin | Manager | Employee |
|--------|-------|-------|---------|----------|
| Manage org settings | ✅ | ❌ | ❌ | ❌ |
| Invite/remove users | ✅ | ✅ | ❌ | ❌ |
| Manage products | ✅ | ✅ | ✅ | ❌ (view only) |
| Create sales | ✅ | ✅ | ✅ | ✅ |
| Edit any sale | ✅ | ✅ | ✅ | ❌ (own only) |
| Record payments | ✅ | ✅ | ✅ | ✅ |
| View reports | ✅ | ✅ | ✅ | ✅ (limited) |

---

### Rule: Owner Protection

**Statement:** Cannot delete the last owner. At least one owner must exist.

**Rationale:** Prevents organization lockout.

**Implementation:** Application validation before deleting/changing user role.

---

## Expense Rules

### Rule: Category Flexibility

**Statement:** Expense categories are free text (no predefined list).

**Rationale:** Every business categorizes differently. Predefined lists don't fit all.

**Common categories:**
- Rent
- Salaries
- Utilities
- Transportation
- Supplier payments
- Marketing

**Future:** Auto-suggest based on historical categories.

---

### Rule: Net Profit Calculation

**Statement:** Net profit = gross profit - expenses.

**Formula:**
```typescript
export function calculateNetProfit(
  grossProfit: Money,
  expenses: Expense[]
): Money {
  return grossProfit - calculateTotalExpenses(expenses)
}
```

**Where:**
```
gross_profit = SUM(sale gross profits)
sale_gross_profit = SUM(item gross profits)
item_gross_profit = (unit_price - cost_price) × quantity
```

---

## Validation Strategy

### Three Layers

**1. UI Validation (instant feedback):**
- Zod schemas with react-hook-form
- Shows errors before submission

**2. Server Validation (security):**
- Server Actions re-validate with same Zod schemas
- Never trust client

**3. Database Constraints (final safeguard):**
- CHECK constraints, foreign keys, triggers
- Catches bugs in application code

**Example: Sale Price ≥ Cost Price**

```typescript
// 1. UI validation
const schema = z.object({
  cost_price: z.number().min(0),
  sale_price: z.number().min(0)
}).refine(data => data.sale_price >= data.cost_price)

// 2. Server validation
const result = schema.safeParse(input)

// 3. Database constraint
ALTER TABLE products 
ADD CONSTRAINT sale_price_gte_cost 
CHECK (sale_price >= cost_price);
```

---

## Rule Testing

Business rules are **pure functions** → easy to test.

**Example test:**
```typescript
describe('calculateMarginPercent', () => {
  it('returns correct margin for profitable product', () => {
    const product = { cost_price: 100, sale_price: 150 }
    expect(calculateMarginPercent(product)).toBe(33.33)
  })
  
  it('returns 0 for zero sale price', () => {
    const product = { cost_price: 100, sale_price: 0 }
    expect(calculateMarginPercent(product)).toBe(0)
  })
})
```

No database, no mocks, instant feedback.

---

## Summary

| Domain | Key Rules | Enforcement |
|--------|-----------|-------------|
| **Customers** | Credit limit, active check, balance calculation | App + DB trigger |
| **Products** | Sale ≥ cost, profit margins | App + DB constraint |
| **Inventory** | No negative stock, low stock alerts | DB constraint + App |
| **Sales** | Completion validations, total calculations | App + DB trigger |
| **Payments** | Amount validation, unallocated payments | App validation |
| **Users** | Role hierarchy, owner protection | App + RLS |
| **Expenses** | Free-form categories, net profit | App logic |

**Business rules are implemented as pure functions, enforced by multiple layers, and maintained by database triggers to guarantee consistency.**
