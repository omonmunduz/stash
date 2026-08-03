/**
 * INVENTORY DOMAIN MODEL
 *
 * Inventory tracks how much of each stocked thing the business has on hand.
 *
 * Two kinds of thing are stocked, and the distinction runs through this whole
 * feature:
 *
 * - Products are sold. They have a sale price and can appear on an invoice.
 * - Items are consumed: carrier bags, tape, packaging, cleaning supplies. They
 *   cost money and running out of them stops trade, so they need counting — but
 *   they are never sold, and there is deliberately no foreign key from sale_items
 *   to inventory_items to make that impossible rather than merely discouraged.
 *
 * One inventory row counts exactly one of the two, enforced by
 * inventory_exactly_one_subject. Rather than expose that nullable pair upward,
 * the domain models it as a discriminated union on `subject` — so calling code
 * cannot read a product's name off an item's stock row.
 *
 * MVP design: single location. Phase 2 adds warehouse_id, and the partial unique
 * indexes on (organization_id, product_id) and (organization_id, item_id) widen
 * to include it.
 *
 * Stock is moved automatically by database triggers when a sale completes or is
 * cancelled, and by line-item edits on a completed sale. Manual adjustments cover
 * everything else, and every one of them is logged — see InventoryAdjustment.
 */

import type {
  InventoryId,
  InventoryItemId,
  InventoryAdjustmentId,
  ProductId,
  OrganizationId,
  UserId,
  Timestamps,
  Auditable,
  Money,
  Quantity,
} from '@/lib/types/common';

/**
 * A non-sellable stocked thing.
 *
 * Shaped deliberately like Product minus sale_price, so the list and form
 * components can mirror the product ones instead of inventing a second set of
 * conventions.
 */
export interface InventoryItem extends Timestamps, Auditable {
  id: InventoryItemId;
  organization_id: OrganizationId;

  /** The business's own code for it. Auto-generated as ITEM-0001 when omitted. */
  item_code: string;

  name: string;
  description: string | null;

  /** Free text, same as products: no predefined list fits every shop. */
  category: string | null;

  /** "unit", "box", "roll", "pack". */
  unit_of_measure: string;

  /**
   * What the business pays per unit. There is no sale_price — that absence is the
   * entire point of the type.
   */
  cost_price: Money;

  /** Storage object path in the private product-images bucket, or null. */
  image_url: string | null;

  /** Warn at or below this. Null means no warning configured; 0 means "only when gone". */
  reorder_level: Quantity | null;

  is_active: boolean;
}

/**
 * What a stock row is counting.
 *
 * A discriminated union rather than two nullable fields, so `subject.kind`
 * narrows and there is no reachable state where both or neither is present.
 */
export type InventorySubject =
  | { kind: 'product'; product_id: ProductId; name: string; code: string }
  | { kind: 'item'; item_id: InventoryItemId; name: string; code: string };

export interface Inventory {
  id: InventoryId;
  organization_id: OrganizationId;
  quantity_on_hand: Quantity;
  updated_at: Date;
  subject: InventorySubject;
}

/**
 * A stock row with everything the inventory screen needs to render one line.
 *
 * cost_price and reorder_level are lifted out of the joined product or item, so
 * the list does not branch on subject.kind for every cell — only where the two
 * genuinely differ, which is the link target and whether a sale price exists.
 */
export interface InventoryLine extends Inventory {
  cost_price: Money;
  reorder_level: Quantity | null;
  unit_of_measure: string;
  image_url: string | null;
  is_active: boolean;

  /** quantity_on_hand × cost_price. Precomputed because the list also totals it. */
  stock_value: Money;

  /** True when a reorder_level is configured and stock has reached it. */
  is_low_stock: boolean;

  /** Sale price when this row counts a product; null for an item. */
  sale_price: Money | null;
}

/**
 * Reason for a manual inventory adjustment.
 *
 * A string union rather than a database enum, matching the reason column's CHECK
 * constraint: widening the list is one ALTER, whereas an enum value can never be
 * removed once added.
 */
export type InventoryAdjustmentReason =
  | 'initial_stock'      // First time setting up stock level
  | 'purchase'           // Received stock from a supplier
  | 'return'             // Customer returned goods
  | 'damage'             // Goods damaged or expired
  | 'loss'               // Goods lost or stolen
  | 'count_correction'   // Physical count revealed a discrepancy
  | 'other';             // Free-text reason, note required

/**
 * One logged stock movement.
 *
 * Append-only: correcting an adjustment means recording another, the way a ledger
 * works. Sale-driven movements are not in this log — the invoice is their
 * explanation.
 */
export interface InventoryAdjustment {
  id: InventoryAdjustmentId;
  organization_id: OrganizationId;
  subject: InventorySubject;

  /** Signed. Positive is stock arriving, negative is stock leaving. Never zero. */
  quantity_delta: Quantity;

  /**
   * What the shelf held once this was applied. Stored rather than derived, so one
   * row can be read without replaying the whole history.
   */
  quantity_after: Quantity;

  reason: InventoryAdjustmentReason;
  notes: string | null;
  adjusted_by: UserId | null;
  adjusted_at: Date;
}

/** Input for creating a non-sellable item. */
export interface CreateInventoryItemInput {
  /** Auto-generated as ITEM-0001 when omitted. */
  item_code?: string;
  name: string;
  description?: string;
  category?: string;
  unit_of_measure?: string;
  cost_price: Money;
  reorder_level?: Quantity | null;
  image_url?: string | null;
  /** Opening stock. A trigger creates the row at 0; this is logged as initial_stock. */
  initial_quantity?: Quantity;
}

/** Input for updating a non-sellable item. Stock is not editable here. */
export interface UpdateInventoryItemInput {
  item_code?: string;
  name?: string;
  description?: string | null;
  category?: string | null;
  unit_of_measure?: string;
  cost_price?: Money;
  reorder_level?: Quantity | null;
  image_url?: string | null;
  is_active?: boolean;
}

/** Which kind of thing a stock operation is about. */
export type InventorySubjectRef =
  | { kind: 'product'; id: ProductId }
  | { kind: 'item'; id: InventoryItemId };

/**
 * Filter for the inventory list.
 *
 * No category field: category lives on the embedded product or item, and
 * PostgREST filters on an embed return the row with a null embed rather than
 * excluding it. Adding it would mean either a client-side filter over every stock
 * row or two separate queries — worth doing when there is a screen asking for it,
 * not before.
 */
export interface InventoryFilter {
  organization_id: OrganizationId;
  /** 'products' and 'items' narrow to one kind; 'all' is the default view. */
  kind?: 'all' | 'products' | 'items';
  low_stock_only?: boolean;
  search?: string;
}

/** Filter for the item catalogue. */
export interface InventoryItemFilter {
  organization_id: OrganizationId;
  status?: 'active' | 'inactive' | 'all';
  category?: string;
  search?: string;
}
