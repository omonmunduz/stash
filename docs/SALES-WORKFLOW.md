# Sales Workflow Design

## Overview

A **sale** represents one transaction where a customer takes goods on credit or pays immediately. The sale moves through a defined lifecycle with automatic inventory and payment tracking.

**Core Concept:** A sale has two independent state machines:
1. **Sale Status:** `draft` → `completed` → (optionally) `cancelled`
2. **Payment Status:** `unpaid` → `partial` → `paid`

These states are **orthogonal** — a sale can be `completed` but `unpaid` (credit sale).

---

## Sale Lifecycle State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│  DRAFT                                                           │
│  - Items can be added/removed                                   │
│  - Inventory NOT affected                                       │
│  - Customer can be changed                                      │
│  - Totals recalculated on every change                         │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ Action: Complete Sale
                   │ Validates: Items exist, inventory sufficient, customer active
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  COMPLETED                                                       │
│  - Inventory DECREASED (automatic trigger)                      │
│  - Items cannot be added/removed                               │
│  - Sale is final (customer received goods)                     │
│  - Payments can be recorded                                    │
│  - Payment status: unpaid → partial → paid                     │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ Action: Cancel Sale
                   │ Validates: Can only cancel completed sales, not drafts
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  CANCELLED                                                       │
│  - Inventory RESTORED (automatic trigger)                       │
│  - Sale is void                                                 │
│  - Payments must be refunded manually                          │
│  - Cannot be un-cancelled (create new sale instead)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Payment Status State Machine

Payment status is **derived** from `total` vs `amount_paid`:

```
amount_paid = 0               → unpaid
0 < amount_paid < total       → partial
amount_paid >= total          → paid
```

**Automatically updated by database trigger when payments are added.**

```
┌─────────────────────────────────────────────────────────────────┐
│  UNPAID                                                          │
│  - amount_paid = 0                                              │
│  - Customer owes full amount                                    │
│  - Credit sale (goods taken, payment later)                    │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ Payment Recorded (partial amount)
                   │ Trigger: Updates amount_paid, amount_due, payment_status
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  PARTIAL                                                         │
│  - 0 < amount_paid < total                                      │
│  - Customer owes remaining balance                              │
│  - Multiple payments can be recorded                            │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ Payment Recorded (remaining balance)
                   │ Trigger: amount_paid = total, payment_status = 'paid'
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  PAID                                                            │
│  - amount_paid >= total                                         │
│  - Customer owes nothing                                        │
│  - Transaction complete                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Complete Sale Creation Workflow

### Step 1: Create Sale (Draft)

**User Action:** Create new sale, select customer

**System Actions:**
```
1. Validate: Customer exists and is active
2. Validate: Customer credit limit not exceeded (soft warning)
3. Create sales record:
   - status = 'draft'
   - customer_id = selected customer
   - subtotal = 0
   - total = 0
   - amount_paid = 0
   - payment_status = 'unpaid'
4. Generate sale_number: INV-2024-0001
```

**Result:** Empty draft sale exists. No items yet.

---

### Step 2: Add Products to Sale

**User Action:** Add product, quantity, optional discount

**System Actions:**
```
1. Validate: Product exists and is active
2. Validate: Quantity > 0
3. Create sale_items record:
   - product_name = products.name (snapshot)
   - unit_price = products.sale_price (snapshot)
   - cost_price = products.cost_price (snapshot)
   - quantity = user input
   - discount = line-level discount
   - subtotal = (quantity × unit_price) - discount
4. Recalculate sale totals:
   - subtotal = SUM(sale_items.subtotal)
   - total = subtotal + tax - sale_discount
   - amount_due = total - amount_paid
```

**Business Rule:** Can add unlimited products. Can add same product multiple times (separate line items).

**Result:** Draft sale with items. Totals calculated. Inventory still NOT affected.

---

### Step 3: Complete Sale

**User Action:** Click "Complete Sale"

**Pre-Flight Validations:**
```typescript
function canCompleteSale(sale, items, customer, inventory): Result<void> {
  // 1. Must have at least one item
  if (items.length === 0) {
    return fail("Sale must have at least one item")
  }
  
  // 2. Customer must be active
  if (!customer.is_active) {
    return fail("Customer is inactive")
  }
  
  // 3. Check credit limit (soft warning if manager override enabled)
  if (!isWithinCreditLimit(customer, sale.total)) {
    return warn("Customer credit limit exceeded")  // Soft warning
  }
  
  // 4. Check inventory for every product
  for (item of items) {
    if (inventory[item.product_id].quantity_on_hand < item.quantity) {
      return fail(`Insufficient stock for ${item.product_name}`)
    }
  }
  
  return success()
}
```

**System Actions (if validations pass):**
```
1. Update sales.status = 'completed'
2. Set sales.sale_date = NOW() (if not already set)
3. Database trigger fires:
   → Decrease inventory for all sale items
   → If any product goes negative, transaction rolls back
4. Update customer.current_balance += sale.amount_due
   (if amount_due > 0, i.e., not fully paid upfront)
```

**Result:** 
- Sale is `completed`
- Inventory reduced
- Customer owes money (if credit sale)
- Goods are with the customer

---

### Step 4A: Record Payment (Full - Immediate)

**Scenario:** Customer pays entire amount at time of sale.

**User Action:** Select "Full payment" option, record amount

**System Actions:**
```
1. Create payments record:
   - customer_id = sale.customer_id
   - sale_id = sale.id
   - amount = sale.total
   - payment_method = 'cash' | 'card' | etc.
   - payment_date = NOW()

2. Database trigger fires:
   → Update sales.amount_paid += payment.amount
   → Update sales.amount_due = total - amount_paid
   → Update sales.payment_status = 'paid' (since amount_paid >= total)
   → Update customer.current_balance -= payment.amount
```

**Result:**
- Sale is `completed` + `paid`
- Customer owes nothing
- Transaction complete in one step

---

### Step 4B: Record Payment (Partial)

**Scenario:** Customer pays 50% now, rest later.

**User Action:** Record partial payment

**System Actions:**
```
1. Create payments record:
   - amount = 500 (out of 1000 total)

2. Database trigger fires:
   → sales.amount_paid = 500
   → sales.amount_due = 500
   → sales.payment_status = 'partial'
   → customer.current_balance = (previous + 1000) - 500
```

**Result:**
- Sale is `completed` + `partial`
- Customer still owes 500
- Can record more payments later

---

### Step 4C: Credit Sale (No Payment)

**Scenario:** Customer takes goods on credit, pays later.

**User Action:** Complete sale without recording payment

**System Actions:**
```
1. Sale completed (status = 'completed')
2. No payment record created
3. Payment status remains 'unpaid'
4. Customer balance increased by full amount
```

**Result:**
- Sale is `completed` + `unpaid`
- Customer owes full amount
- Payment can be recorded days/weeks later

---

### Step 5: Record Subsequent Payments

**Scenario:** Customer returns to pay remaining balance.

**User Action:** From customer page or payments page, record payment

**System Actions:**
```
1. Create payments record:
   - sale_id = (optional - can be unallocated if not specified)
   - amount = 500 (remaining balance)

2. If sale_id is specified:
   → Trigger updates sales.amount_paid
   → Trigger updates sales.payment_status = 'paid'
   
3. Trigger updates customer.current_balance -= payment.amount
```

**Business Rule:** Payments can be recorded against a specific sale OR as an unallocated payment to customer's account.

**Result:** Sale is now `completed` + `paid`. Customer balance = 0.

---

### Step 6: Cancel Sale

**Scenario:** Sale was completed but needs to be voided (goods returned, error, etc.)

**User Action:** Click "Cancel Sale"

**Validations:**
```typescript
function canCancelSale(sale): Result<void> {
  // 1. Cannot cancel a draft (just delete it)
  if (sale.status === 'draft') {
    return fail("Delete draft sales instead of cancelling")
  }
  
  // 2. Cannot cancel if already cancelled
  if (sale.status === 'cancelled') {
    return fail("Sale is already cancelled")
  }
  
  // 3. Soft warning if payments exist
  if (sale.amount_paid > 0) {
    return warn("Sale has payments. You must refund them separately.")
  }
  
  return success()
}
```

**System Actions:**
```
1. Update sales.status = 'cancelled'

2. Database trigger fires:
   → Restore inventory (reverse the decrease)
   → For each sale_item: inventory.quantity_on_hand += quantity

3. Update customer.current_balance -= sale.amount_due
   (removes the debt if sale was unpaid/partial)
```

**Important:** Payments are NOT automatically reversed. Manager must:
- Void the payment records manually (soft delete)
- Give customer a refund (cash/bank transfer)

**Result:**
- Sale is `cancelled`
- Inventory restored
- Customer debt removed
- Payments must be handled manually

---

## Sale Scenarios Matrix

| Scenario | Flow | Final State | Notes |
|----------|------|-------------|-------|
| **Cash Sale** | Draft → Add Items → Complete → Pay Full | `completed` + `paid` | One-step transaction |
| **Credit Sale** | Draft → Add Items → Complete → (no payment) | `completed` + `unpaid` | Customer pays later |
| **Partial Payment** | Draft → Add Items → Complete → Pay 50% → Pay 50% | `completed` + `paid` (after 2nd payment) | Multiple payments |
| **Layaway** | Draft → (keep as draft) → (customer returns) → Complete → Pay | `completed` + `paid` | Draft sits until ready |
| **Return/Cancel** | Completed Sale → Cancel | `cancelled` | Inventory restored |
| **Abandoned Draft** | Draft → (never completed) | `draft` | Can be deleted |

---

## Multi-Payment Example

**Sale #789: Total 10,000 KGS**

```
Day 1: Sale completed (no payment)
  - status: completed
  - payment_status: unpaid
  - amount_paid: 0
  - amount_due: 10,000
  - customer.current_balance: +10,000

Day 3: Customer pays 3,000
  - Payment #1 recorded: 3,000 KGS
  - payment_status: partial
  - amount_paid: 3,000
  - amount_due: 7,000
  - customer.current_balance: 7,000

Day 7: Customer pays 4,000
  - Payment #2 recorded: 4,000 KGS
  - payment_status: partial
  - amount_paid: 7,000
  - amount_due: 3,000
  - customer.current_balance: 3,000

Day 10: Customer pays 3,000 (final)
  - Payment #3 recorded: 3,000 KGS
  - payment_status: paid ✅
  - amount_paid: 10,000
  - amount_due: 0
  - customer.current_balance: 0
```

---

## Database Triggers

### Trigger 1: Update Sale Payment Status

**When:** INSERT or DELETE on payments table  
**Action:** Recalculate `amount_paid`, `amount_due`, `payment_status` for the sale

```sql
CREATE TRIGGER trg_update_sale_payment_status
AFTER INSERT OR DELETE ON payments
FOR EACH ROW
WHEN (NEW.sale_id IS NOT NULL OR OLD.sale_id IS NOT NULL)
EXECUTE FUNCTION fn_update_sale_payment_status();
```

**Logic:**
```sql
UPDATE sales SET
  amount_paid = (SELECT COALESCE(SUM(amount), 0) 
                 FROM payments 
                 WHERE sale_id = :sale_id AND deleted_at IS NULL),
  amount_due = total - amount_paid,
  payment_status = CASE
    WHEN amount_paid = 0 THEN 'unpaid'
    WHEN amount_paid < total THEN 'partial'
    ELSE 'paid'
  END
WHERE id = :sale_id;
```

### Trigger 2: Update Customer Balance

**When:** INSERT on payments, UPDATE on sales.status, INSERT on sales (completed)  
**Action:** Adjust `customer.current_balance`

**Rules:**
- Sale completed (unpaid/partial): `balance += amount_due`
- Payment recorded: `balance -= payment.amount`
- Sale cancelled: `balance -= amount_due` (removes debt)

---

## Business Rules Summary

### Rule 1: Draft Sales Don't Affect Anything
- Inventory unchanged
- Customer balance unchanged
- Can be edited freely
- Can be deleted without consequence

### Rule 2: Completing a Sale is Irreversible (Except by Cancellation)
- Once completed, items cannot be added/removed
- Inventory is decreased
- Customer is charged (if credit)
- The only reversal is cancellation

### Rule 3: Payments Are Independent of Sale Status
- Can record payments while sale is being created (advance payment)
- Can record payments days after sale is completed
- Can record overpayments (creates credit on customer account)

### Rule 4: Amount Paid is Denormalized
- `sales.amount_paid` = SUM of payments
- Kept in sync by database trigger
- Application never writes to this field directly

### Rule 5: Payment Status is Derived
- Automatically calculated from `amount_paid` vs `total`
- Application never sets this field
- Database trigger updates it

### Rule 6: Cancellation Doesn't Auto-Refund
- Inventory is restored (automatic)
- Customer debt is removed (automatic)
- Payments must be refunded manually (user action)
- This prevents accidentally refunding before confirming with customer

### Rule 7: Multiple Payments for One Sale
- No limit on number of payments
- Each payment reduces `amount_due`
- Payments can exceed total (creates account credit)

### Rule 8: Unallocated Payments
- Payments can have `sale_id = NULL`
- Represents: advance payment, account credit, or payment toward overall debt
- Reduces customer balance but not tied to specific sale

---

## Key Queries

### Get Sale with Full Details (for Invoice)
```sql
SELECT 
  s.*,
  c.name AS customer_name,
  c.customer_code,
  json_agg(si.*) AS items,
  json_agg(p.*) AS payments
FROM sales s
JOIN customers c ON s.customer_id = c.id
LEFT JOIN sale_items si ON si.sale_id = s.id
LEFT JOIN payments p ON p.sale_id = s.id
WHERE s.id = :sale_id
GROUP BY s.id, c.id;
```

### Get Overdue Sales
```sql
SELECT s.*, c.name AS customer_name
FROM sales s
JOIN customers c ON s.customer_id = c.id
WHERE s.due_date < CURRENT_DATE
  AND s.payment_status IN ('unpaid', 'partial')
  AND s.status = 'completed'
ORDER BY s.due_date ASC;
```

### Get Sales by Customer (for Account Statement)
```sql
SELECT 
  s.sale_number,
  s.sale_date,
  s.total,
  s.amount_paid,
  s.amount_due,
  s.payment_status
FROM sales s
WHERE s.customer_id = :customer_id
  AND s.status = 'completed'
ORDER BY s.sale_date DESC;
```

---

## State Transition Rules Table

| From State | Action | To State | Validations | Side Effects |
|------------|--------|----------|-------------|--------------|
| (none) | Create Sale | `draft` | Customer active | Generate sale_number |
| `draft` | Add Item | `draft` | Product active, qty > 0 | Recalc totals |
| `draft` | Complete | `completed` | Items exist, inventory sufficient | Decrease inventory, charge customer |
| `draft` | Delete | (deleted) | None | No side effects |
| `completed` | Record Payment | `completed` | Amount > 0 | Update payment_status, reduce balance |
| `completed` | Cancel | `cancelled` | Not already cancelled | Restore inventory, remove debt |
| `cancelled` | (none) | — | Cannot be reversed | Create new sale instead |

---

## Sale Lifecycle Diagram (Complete)

```
         ┌─────────┐
         │  START  │
         └────┬────┘
              │ create sale
              ▼
         ┌─────────┐
    ┌────│  DRAFT  │◄───┐
    │    └────┬────┘    │ edit items
    │         │         │
    │         │ complete│
    │         ▼         │
    │    ┌──────────┐   │
    │    │COMPLETED │───┘
    │    │          │
    │    │payment:  │
    │    │unpaid    │
    │    └────┬─────┘
    │         │ record payment
    │         ▼
    │    ┌──────────┐
    │    │COMPLETED │
    │    │          │
    │    │payment:  │
    │    │partial   │
    │    └────┬─────┘
    │         │ record final payment
    │         ▼
    │    ┌──────────┐
    │    │COMPLETED │
    │    │          │
    │    │payment:  │
    │    │paid ✓    │
    │    └────┬─────┘
    │         │
    │         │ (or) cancel from any completed state
    │         ▼
    │    ┌──────────┐
    └───►│CANCELLED │
         └──────────┘
```

---

## Summary

| Concept | Implementation | Why |
|---------|----------------|-----|
| **Two state machines** | `status` (draft/completed/cancelled) + `payment_status` (unpaid/partial/paid) | Sale completion and payment are independent |
| **Drafts are ephemeral** | No inventory/balance impact | Allows building sale over time without locking stock |
| **Completion is atomic** | All validations + inventory decrease in one transaction | Either succeeds completely or fails safely |
| **Payment status is derived** | Trigger calculates from `amount_paid` vs `total` | Single source of truth, no sync issues |
| **Multiple payments supported** | Each payment record reduces `amount_due` | Real-world: customers pay in installments |
| **Cancellation restores inventory** | Trigger reverses the decrease | Returns goods to available stock |
| **Payments aren't auto-refunded** | Manager handles refunds manually | Prevents accidental refunds |

**The sales workflow supports every real-world wholesale scenario while maintaining data consistency through database-enforced rules.**