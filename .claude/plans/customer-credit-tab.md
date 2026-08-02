# Customer Credit / Tab System

## What already exists (do not rebuild)

- `sales`, `sale_items`, `payments` tables with all required columns, indexes, RLS.
  `sale_items` already snapshots `product_name` / `product_sku` / `quantity` /
  `unit_price` / `cost_price` / `subtotal`.
- Triggers: sale totals recalc from items, `payment_status` derivation,
  `customer.current_balance` maintenance, inventory deduct/restore on
  complete/cancel, invoice numbering on completion.
- `features/customers` fully built (repo → service → actions → pages), including a
  detail page rendering balance + sales history + payments history.
- `features/{sales,payments,products,inventory}`: types, Zod schemas, pure
  business rules, and repository **interfaces** only. No implementations.

## The one real data-model gap

FIFO oldest-debt-first is not representable today. `payments.sale_id` is either
set (one sale) or NULL (reduces `current_balance` while every sale keeps showing
its full `amount_due`). Fix: a `payment_allocations` join table.

---

## Phase 1 — Migration `20260730000001_payment_allocations.sql`

New table:

```
payment_allocations
  id, organization_id, payment_id -> payments(id) ON DELETE CASCADE,
  sale_id -> sales(id) ON DELETE RESTRICT,
  amount DECIMAL(15,2) CHECK (amount > 0),
  created_at
  UNIQUE (payment_id, sale_id)
```

- Indexes on `(sale_id)` and `(organization_id, payment_id)`.
- RLS mirroring `sale_items`: SELECT same-org; INSERT/UPDATE/DELETE follow the
  parent payment (any role may insert, manager+ may change).

Trigger rework (replaces two existing functions):

- `fn_recalc_sale_payment_from_allocations(sale_id)` — sums non-deleted
  allocations for a sale, writes `amount_paid` / `amount_due` / `payment_status`.
  Fired from `payment_allocations` (I/U/D) **and** from `payments` (amount change
  or soft-delete), since voiding a payment must un-pay its sales.
- `fn_update_customer_balance` — reformulated to:
  `SUM(completed sales amount_due) - SUM(payment.amount - allocated portion)`.
  The unapplied remainder of a payment is the account credit; allocated portions
  already show up via each sale's `amount_due`.
- Backfill `payment_allocations` from existing `payments WHERE sale_id IS NOT NULL`,
  then `DROP COLUMN payments.sale_id` so there is exactly one source of truth.

Two RPCs, so multi-row writes are atomic and race-free:

- `record_customer_payment(org, customer, amount, method, date, reference, notes,
  p_sale_id DEFAULT NULL)` — inserts the payment, then walks that customer's
  unpaid completed sales `ORDER BY sale_date, created_at` under
  `FOR UPDATE`, inserting allocation rows until the money runs out. Remainder
  stays unallocated as credit. When `p_sale_id` is passed it is allocated first,
  then the remainder cascades FIFO.
- `create_sale_with_items(org, customer, sale_date, due_date, notes, items jsonb,
  amount_paid_upfront, payment_method)` — creates the draft, inserts items,
  completes it (so the existing numbering + inventory triggers fire), and records
  any upfront payment allocated to that sale. One transaction: a stock failure
  rolls the whole thing back instead of leaving an orphan draft.

**Why RPCs rather than sequential client calls:** the repository already does this
for `generate_customer_code` and gives the reason — a read-then-write split across
round trips can interleave. A half-allocated payment would under-credit sales, and
a sale that completes with only some items would deduct the wrong stock.

`database.types.ts` is hand-edited to add the table + RPC signatures and drop
`payments.sale_id`. Regenerating needs the remote DB migrated first.

**You run the migration** — `supabase db push` against your linked project. I will
not push it, since it drops a column on a shared database.

## Phase 2 — Products (minimum for a working sale form)

- `features/products/{queries,mapper,repository,service,server}.ts` following the
  customers pattern exactly (interface + Supabase impl in one file, `Result` at the
  service boundary, explicit column lists).
- `app/actions/products.ts`, `ProductForm`, `ProductList`.
- Pages: `/products`, `/products/new`, `/products/[id]/edit`.
- Inventory read-only: stock shown on the list, no adjustment screen.

## Phase 3 — Sales

- `features/sales/{queries,mapper,repository,service,server}.ts`.
- `app/actions/sales.ts`.
- `SaleForm`: customer picker, repeatable line items (product, qty, unit price
  prefilled from `sale_price`, live subtotal), running total, "paid upfront"
  field accepting zero/partial/full, credit-limit warning via the existing
  `checkCreditForSale`.
- Pages: `/sales`, `/sales/new`, `/sales/[id]`.

## Phase 4 — Payments

- `features/payments/{queries,mapper,repository,service,server}.ts` — `create`
  calls the FIFO RPC.
- `app/actions/payments.ts`.
- `RecordPaymentForm` (amount, method, date, reference, notes) rendered inline on
  the customer detail page, showing which invoices the money will clear.
- No `/payments` list page — recording happens where the money is taken. Nav entry
  stays disabled.

## Phase 5 — Customer detail: line items + record payment

- `features/customers/queries.ts`: add a `sale_items` batch query for the
  customer's sales, and an allocations query for their payments.
- `history.ts`: attach `items[]` to each sale row and `allocations[]` to each
  payment row. Loaded with the page so expanding is instant and needs no fetch.
- `CustomerHistory.tsx` becomes a Client Component: each sale row gets a
  chevron toggle expanding a second `<tr>` (`colSpan`) listing product name,
  quantity, unit price, subtotal. Keeps valid table markup.
- Payment rows show the invoices each payment cleared; any unapplied remainder
  keeps the existing "On account" badge.
- Existing `Settled` / `Owes` / `Paid` / `Part paid` badge variants reused
  unchanged. Sales list switches from completed-only to including drafts.
- Mobile: line items render as stacked rows, not a scrolling table.

## Phase 6 — Wiring and small corrections

- `navigation.ts`: flip Sales and Products to `available: true`.
- `Sale.sale_number` is typed `string` but is null for drafts — correct to
  `string | null`.
- `Product` type and `createProductSchema` declare `barcode` / `reorder_level`,
  which the canonical schema deliberately omits for MVP. Remove them so the
  mapper cannot reference non-existent columns.
- `features/payments/business-rules.ts::isUnallocatedPayment` reads the dropped
  `sale_id`; re-express against allocations.
- Update `docs/BUSINESS-RULES.md` and `docs/DATABASE.md` balance formulas.

## Verification

`npm run type-check` and `npm run build` must both pass before I report done.
Runtime behaviour of the FIFO RPC cannot be verified without the migration
applied to your database — I will say so explicitly rather than implying it was
tested.

## Out of scope

Payments list page, inventory adjustment screen, reports, expenses, settings,
invoice PDFs, barcode scanning.
