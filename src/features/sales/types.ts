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

  /** Human-readable invoice number. Format: INV-YYYY-NNNN */
  sale_number: string;

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
 * - No updated_at: line items are either added or removed, never partially updated
 *   in a way that would need audit. The sale's updated_at covers the parent.
 */
export interface SaleItem {
  id: SaleItemId;
  organization_id: OrganizationId;
  sale_id: SaleId;
  product_id: ProductId;

  /** Snapshot of product name at sale time */
  product_name: string;

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
}

// ── Input Types ───────────────────────────────────────────────────────────────

/** Input for creating a new sale (header only — items added via addItem) */
export interface CreateSaleInput {
  customer_id: CustomerId;
  sale_date?: Date;        // defaults to today
  due_date?: Date;
  tax?: Money;             // defaults to 0
  discount?: Money;        // defaults to 0
  notes?: string;
}

/** Input for adding a line item to a sale */
export interface AddSaleItemInput {
  product_id: ProductId;
  quantity: Quantity;
  unit_price?: Money;      // defaults to product.sale_price
  discount?: Money;        // defaults to 0
}

/** Input for updating sale-level fields */
export interface UpdateSaleInput {
  sale_date?: Date;
  due_date?: Date | null;
  tax?: Money;
  discount?: Money;
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
    amount: Money;
    payment_date: Date;
    payment_method: string;
    reference_number: string | null;
  }>;
}
