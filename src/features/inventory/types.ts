/**
 * INVENTORY DOMAIN MODEL
 *
 * Inventory tracks how many units of each product the business has on hand.
 *
 * MVP design: one inventory record per product per organization (single location).
 * Phase 2: add warehouse_id for multi-location support — the UNIQUE constraint
 * on (organization_id, product_id) will become (organization_id, product_id, warehouse_id).
 *
 * Inventory levels are automatically adjusted by database triggers when a sale
 * is marked as "completed". Manual adjustments are also supported for:
 * - Initial stock entry
 * - Stock received from suppliers
 * - Damaged/lost goods write-offs
 * - Physical count corrections
 */

import type {
  InventoryId,
  ProductId,
  OrganizationId,
  UserId,
  Quantity,
} from '@/lib/types/common';
import type { Product } from '@/features/products/types';

export interface Inventory {
  id: InventoryId;
  organization_id: OrganizationId;
  product_id: ProductId;
  quantity_on_hand: Quantity;
  updated_at: Date;
}

/**
 * Reason for a manual inventory adjustment.
 * Kept as a string union (not DB enum) so we can add reasons without a migration.
 */
export type InventoryAdjustmentReason =
  | 'initial_stock'      // First time setting up stock level
  | 'purchase'           // Received stock from supplier
  | 'return'             // Customer returned goods
  | 'damage'             // Goods damaged or expired
  | 'loss'               // Goods lost or stolen
  | 'count_correction'   // Physical count revealed discrepancy
  | 'other';             // Free-text reason

/**
 * Represents a manual inventory adjustment event.
 * This is a domain object (not directly a DB table in MVP).
 * Phase 2: promote to a full audit_log table.
 */
export interface InventoryAdjustment {
  product_id: ProductId;
  organization_id: OrganizationId;
  /**
   * Positive = stock coming in, negative = stock going out.
   * Example: +50 means received 50 units. -3 means 3 units damaged.
   */
  quantity_delta: Quantity;
  reason: InventoryAdjustmentReason;
  notes?: string;
  adjusted_by: UserId;
  adjusted_at: Date;
}

/** Inventory joined with its product details */
export interface InventoryWithProduct extends Inventory {
  product: Product;
  is_low_stock: boolean;
}

/** Filter for querying inventory */
export interface InventoryFilter {
  organization_id: OrganizationId;
  low_stock_only?: boolean;
  category?: string;
  search?: string;
}
