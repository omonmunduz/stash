/**
 * SALE DOMAIN MODEL
 *
 * A sale represents one transaction where a customer picks up goods.
 * It is the central entity of the application — it links customers,
 * products, inventory, and payments together.
 *
 * Lifecycle:
 *   draft → completed → (optionally) payments recorded
 *   draft → cancelled
 *
 * Design decisions:
 * - status 'draft' allows building a sale before confirming it.
 * - Completing a sale triggers inventory deduction (DB trigger).
 * - amount_paid and amount_due are denormalized for read performance.
 *   They are kept in sync by DB triggers when payments are inserted/deleted.
 * - sale_number is human-readable: INV-2024-0001. Format is year-based.
 * - SaleItem is part of this feature (not its own feature folder) because
 *   a sale item has no meaning outside of a sale.
 *
 * Schema: `cost_price` is stored as a snapshot on each SaleItem so that
 * per-sale gross profit can be calculated historically even after
 * product.cost_price changes.
 */

import type {
  SaleId,
  SaleItemId,
  CustomerId,
  ProductId,
  OrganizationId,
  UserId,
  Timestamps,
  Auditable,
  Money,
  Quantity,
} from '@/lib/types/common';
import type { PaymentMethod } from '@/features/payments/types';

/** Lifecycle status of a sale */
export type SaleStatus = 'draft' | 'completed' | 'cancelled';

/**
 * Payment collection status — derived from total vs amount_paid.
 * Denormalized on the sale row and kept in sync by triggers.
 */
export type SalePaymentStatus = 'unpaid' | 'partial' | 'paid';

/** A sale/invoice transaction */
export interface Sale extends Timestamps, Auditable {
  id: SaleId;
  organization_id: OrganizationId;

  /**
   * Human-readable invoice number. Format: INV-YYYY-NNNN
   *
   * Null while the sale is a draft. The number is assigned by
   * trg_set_sale_number when the sale moves to 'completed', so that abandoned
   * drafts do not burn invoice numbers and leave gaps in the sequence.
   */
  sale_number: string | null;

  customer_id: CustomerId;

  /** Date the sale occurred (not necessarily today) */
  sale_date: Date;

  /** Optional payment due date for credit sales */
  due_date: Date | null;

  status: SaleStatus;

  /** Sum of all line item subtotals, before tax and sale-level discount */
  subtotal: Money;

  /** Tax amount applied to the sale */
  tax: Money;

  /** Sale-level discount (applied after tax) */
  discount: Money;

  /** subtotal + tax − discount */
  total: Money;

  /** Denormalized: sum of all Payment records linked to this sale */
  amount_paid: Money;

  /** Denormalized: total − amount_paid */
  amount_due: Money;

  payment_status: SalePaymentStatus;
  notes: string | null;

  /**
   * Who last changed this sale, if anyone has. Null on a sale that has never
   * been edited since it was recorded.
   *
   * Paired with `updated_at` from Timestamps, this is the audit trail for
   * after-the-fact corrections: the shop owner fixing a quantity three days
   * later leaves a mark, which is the whole point of allowing the edit.
   */
  updated_by: UserId | null;
}

/**
 * A single line item on a sale.
 *
 * Design decisions:
 * - product_name, unit_price, and cost_price are all snapshots taken at sale time.
 *   Products can be renamed or repriced later — the invoice and profit reports
 *   must reflect what was true at the time of the transaction.
 * - cost_price enables historical gross profit calculation per sale even after
 *   product.cost_price changes in the future.
 * - updated_at / updated_by are on the line, not just the parent sale. A
 *   quantity corrected days later is the exact thing the shop owner needs to be
 *   able to point at, and "the sale changed at 4pm" does not say which line.
 */
export interface SaleItem {
  id: SaleItemId;
  organization_id: OrganizationId;
  sale_id: SaleId;
  product_id: ProductId;

  /** Snapshot of product name at sale time */
  product_name: string;

  /**
   * Snapshot of the product SKU at sale time. Empty string when the product had
   * no SKU — the column is nullable, but every read site wants a string to
   * render, so the mapper collapses null rather than pushing the check outward.
   */
  product_sku: string;

  quantity: Quantity;

  /** Snapshot of selling price at sale time */
  unit_price: Money;

  /**
   * Snapshot of cost price at sale time.
   * Set automatically from product.cost_price when the item is added.
   * Never editable by users — it is a historical record.
   * Used to calculate gross profit: (unit_price - cost_price) × quantity
   */
  cost_price: Money;

  /** Line-level discount amount */
  discount: Money;

  /** (quantity × unit_price) − discount */
  subtotal: Money;

  created_at: Date;

  /** Last time this line was corrected. Equals created_at for untouched lines. */
  updated_at: Date;

  /** Who last corrected this line. Null for lines never edited since creation. */
  updated_by: UserId | null;
}

// ── Input Types ───────────────────────────────────────────────────────────────

/** One line on a new sale, as submitted by the sale form. */
export interface CreateSaleItemInput {
  product_id: ProductId;
  quantity: Quantity;
  /** Defaults to the product's current sale_price when the form leaves it alone. */
  unit_price: Money;
  discount?: Money;
}

/**
 * Input for creating a whole sale at once: header, lines, and whatever the
 * customer handed over at the counter.
 *
 * `amount_paid` is what was paid upfront, which may be zero (pure credit), part
 * of the total (partial), or the full amount (cash sale). Anything above the
 * total is kept as account credit against the customer's next purchase rather
 * than rejected — customers round up, and refusing the payment is worse than
 * carrying the difference forward.
 */
export interface CreateSaleWithItemsInput {
  customer_id: CustomerId;
  items: CreateSaleItemInput[];
  sale_date?: Date;
  due_date?: Date | null;
  notes?: string | null;
  amount_paid?: Money;
  payment_method?: PaymentMethod;
}

/**
 * Input for adding a line item to a sale, or editing one already on it.
 *
 * `id` is what distinguishes the two: absent means add a line, present means
 * correct the line with that id. Both go through the same RPC because both have
 * the same consequences — the sale total moves, stock moves, and the customer's
 * tab moves — and splitting them into two paths would mean maintaining that
 * cascade twice.
 *
 * Editing is deliberately not restricted to drafts. The shop records a sale when
 * the goods leave the shelf, so by the time anyone notices a wrong quantity the
 * sale is long completed. Refusing to edit it would mean the only correction
 * available is voiding a real transaction and re-typing it.
 */
export interface UpsertSaleItemInput {
  /** Omit to add a new line; supply to edit an existing one. */
  id?: SaleItemId;
  product_id: ProductId;
  quantity: Quantity;
  unit_price?: Money;      // defaults to product.sale_price
  discount?: Money;        // defaults to 0
}

/**
 * Kept as an alias so existing callers and the addSaleItemSchema name still
 * read naturally: adding is the no-id case of an upsert.
 */
export type AddSaleItemInput = Omit<UpsertSaleItemInput, 'id'>;

/**
 * Input for updating sale-level fields.
 *
 * tax and discount are absent deliberately: they feed subtotal/total, which
 * triggers recalculate from the line items. Letting a caller patch them here
 * would put the header out of step with its own lines until the next item change.
 */
export interface UpdateSaleInput {
  sale_date?: Date;
  due_date?: Date | null;
  notes?: string | null;
}

// ── Filter & Query Types ──────────────────────────────────────────────────────

/** Filter parameters for querying sales */
export interface SaleFilter {
  organization_id: OrganizationId;
  customer_id?: CustomerId;
  status?: SaleStatus;
  payment_status?: SalePaymentStatus;
  date_from?: Date;
  date_to?: Date;
  /** Only overdue sales: due_date < today and payment_status != 'paid' */
  overdue_only?: boolean;
  search?: string;
}

/** Sale with its line items — the most common query shape */
export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

/** Full sale detail for invoice view: includes customer and payments */
export interface SaleWithDetails extends SaleWithItems {
  customer: {
    id: CustomerId;
    name: string;
    business_name: string | null;
    customer_code: string;
    phone: string | null;
  };
  payments: Array<{
    id: string;
    payment_number: string;
    /**
     * The portion of that payment applied to THIS sale, read from the allocation
     * row — not the payment's face value. A single payment settling three
     * invoices appears on each of them with a different amount here.
     */
    amount: Money;
    payment_date: Date;
    payment_method: PaymentMethod;
    reference_number: string | null;
  }>;
}
