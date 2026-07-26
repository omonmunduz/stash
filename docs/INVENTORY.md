# Inventory System Design

## Overview

The inventory system tracks stock levels for products in a **single warehouse** (MVP). Inventory is automatically adjusted by database triggers when sales are completed or cancelled, and can be manually adjusted for receiving stock, corrections, and write-offs.

**Core Principle:** The database is the source of truth. Triggers ensure consistency.

---

## Architecture

```
Products (cost_price, sale_price, reorder_level)
    ↓ 1:1 relationship
Inventory (product_id, quantity_on_hand)
    ↓ Automatically adjusted by:
    ├─ Sale Completed (triggers decrease)
    ├─ Sale Cancelled (triggers increase)
    └─ Manual Adjustments (user action)
```

---

## 12 Core Business Rules

### Rule 1: One Inventory Record Per Product
**Rule:** Each product has exactly one inventory record. Single warehouse in MVP.  
**Enforcement:** Database unique index on `(organization_id, product_id)`  
**Consequence:** Queries are simple (no joins across warehouses)

### Rule 2: Negative Stock is Prevented
**Rule:** `quantity_on_hand` cannot go below zero.  
**Enforcement:** `CHECK (quantity_on_hand >= 0)` constraint  
**Consequence:** Transactions roll back if they would create negative stock

### Rule 3: Inventory Decreases on Sale Completion
**Rule:** When sale status changes `draft` → `completed`, inventory decreases by sale quantities.  
**Enforcement:** Database trigger `trg_decrease_inventory_on_sale_completed`  
**Consequence:** Automatic. No application code needed. Sale completion fails if insufficient stock.

### Rule 4: Inventory Increases on Sale Cancellation
**Rule:** When sale status changes `completed` → `cancelled`, inventory increases (reversal).  
**Enforcement:** Database trigger `trg_restore_inventory_on_sale_cancelled`  
**Consequence:** Returns are handled automatically. Payments must be refunded separately.

### Rule 5: Draft Sales Do NOT Reserve Inventory
**Rule:** A `draft` sale does not reduce `quantity_on_hand`.  
**Why:** Prevents phantom shortages. Wholesale drafts may sit for days.  
**Consequence:** Race condition possible — two employees can draft the same stock. First to complete wins.

### Rule 6: Manual Adjustments Require Reasons
**Rule:** Every manual adjustment must have a `reason` enum value.  
**Reasons:** `initial_stock`, `purchase`, `return`, `damage`, `loss`, `count_correction`, `other`  
**Enforcement:** Application validation  
**Consequence:** Audit trail for every non-sale inventory change

### Rule 7: Low Stock Detection
**Rule:** Product is "low stock" when `quantity_on_hand <= reorder_level`.  
**Implementation:** Application query (not RLS)  
**Consequence:** Dashboard shows low stock count. Inventory page highlights alerts.

### Rule 8: Profit Uses Snapshot Cost Price
**Rule:** Gross profit = `(sale_items.unit_price - sale_items.cost_price) × quantity`  
**Why:** Historical profit must use historical costs, not current `products.cost_price`  
**Consequence:** When sale is created, `products.cost_price` is copied to `sale_items.cost_price` as a snapshot

**Example:**
```
Product: Olive Oil
Cost today: 100 KGS
Sale today: cost_price snapshot = 100

1 month later:
Product cost updated: 120 KGS
Profit report for last month: still shows 100 KGS cost (snapshot)
```

### Rule 9: Inventory Value Calculation
**Rule:** Total inventory value = `SUM(quantity_on_hand × current cost_price)`  
**Uses:** Current cost_price (not snapshot) because we're valuing current stock  
**Query:**
```sql
SELECT SUM(i.quantity_on_hand * p.cost_price)
FROM inventory i JOIN products p ON i.product_id = p.id
```

### Rule 10: Insufficient Stock Prevents Sale Completion
**Rule:** Sale cannot transition `draft` → `completed` if any item has `quantity > available stock`.  
**Enforcement:** App check (user-friendly error) + DB trigger (final safeguard)  
**Error Message:** "Insufficient stock for Flour 50kg. Available: 10, needed: 20."

### Rule 11: Inventory Adjustments Are Atomic
**Rule:** Multi-product sales adjust inventory in a single transaction.  
**Consequence:** Either all items succeed or none do. No partial decreases.

### Rule 12: Products with Sales History Cannot Be Hard-Deleted
**Rule:** If a product appears in `sale_items`, it cannot be hard-deleted.  
**Enforcement:** `BEFORE DELETE` trigger raises exception  
**Action:** Must soft-delete (`deleted_at = NOW(), is_active = false`)  
**Why:** Preserves invoice history and foreign key integrity

---

## Inventory Lifecycle

```
Product Created
    ↓
Inventory: 0 units (or initial_stock if provided)
    ↓
Manual Adjustment: +100 (reason: purchase)
    ↓
Inventory: 100 units
    ↓
Sale #1 Completed: -20 units
    ↓
Inventory: 80 units
    ↓
Sale #2 Completed: -30 units
    ↓
Inventory: 50 units (⚠️ Low Stock if reorder_level = 60)
    ↓
Manual Adjustment: +100 (reason: purchase)
    ↓
Inventory: 150 units
    ↓
Sale #1 Cancelled: +20 units (return)
    ↓
Inventory: 170 units
```

---

## Profit Calculation Formulas

### Product Level
```
Gross Profit per Unit = Sale Price - Cost Price
Gross Margin % = (Gross Profit / Sale Price) × 100
```

**Example:**
```
Rice 10kg: Cost 120 KGS, Sale 180 KGS
Profit: 60 KGS
Margin: 33.3%
```

### Sale Level
```
Item Gross Profit = (unit_price - cost_price) × quantity - discount
Sale Gross Profit = SUM(item profits)
```

**Example:**
```
Sale #456:
  Item 1: 5 units × (180 - 120) = 300 KGS
  Item 2: 2 units × (250 - 150) - 20 discount = 180 KGS
  
  Total Gross Profit: 480 KGS
```

### Business Level
```
Net Profit = Gross Profit - Expenses
```

---

## Key Queries

**Low Stock Products:**
```sql
SELECT p.name, i.quantity_on_hand, p.reorder_level
FROM products p
JOIN inventory i ON p.id = i.product_id
WHERE i.quantity_on_hand <= p.reorder_level
  AND p.is_active = true;
```

**Total Inventory Value:**
```sql
SELECT SUM(i.quantity_on_hand * p.cost_price)
FROM inventory i JOIN products p ON i.product_id = p.id
WHERE p.organization_id = :org_id;
```

**Check Sale Can Be Completed:**
```sql
SELECT si.product_name, si.quantity AS needed, i.quantity_on_hand AS available
FROM sale_items si
JOIN inventory i ON si.product_id = i.product_id
WHERE si.sale_id = :sale_id AND i.quantity_on_hand < si.quantity;
```

---

## Multi-Warehouse (Phase 2)

**Schema Change:** Add `warehouse_id` to `inventory` table.

```sql
ALTER TABLE inventory ADD COLUMN warehouse_id UUID REFERENCES warehouses(id);

-- Change unique constraint
CREATE UNIQUE INDEX inventory_product_warehouse_unique
ON inventory(organization_id, product_id, warehouse_id);
```

**Consequences:**
- Each product can have multiple inventory records (one per warehouse)
- Queries must aggregate: `SUM(quantity_on_hand) GROUP BY product_id`
- Sales must specify source warehouse
- Warehouse transfers become a new operation

---

## Summary

| Business Rule | Layer | Result |
|---------------|-------|--------|
| One inventory per product | Database | Prevents duplicates |
| No negative stock | Database | Transaction fails |
| Decrease on sale completion | Database trigger | Automatic |
| Increase on sale cancellation | Database trigger | Automatic reversal |
| Drafts don't reserve | App logic | Race condition possible |
| Adjustments need reasons | App validation | Audit trail |
| Low stock detection | App query | Dashboard alerts |
| Profit uses snapshot cost | Database schema | Accurate history |
| Insufficient stock blocks | App + DB trigger | Safe fallback |
| Can't delete with sales | DB trigger | Data integrity |

**The inventory system prevents data corruption through database enforcement while providing flexibility through application business logic.**
