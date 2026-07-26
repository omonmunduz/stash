/**
 * INVENTORY REPOSITORY INTERFACE
 */

import type {
  Inventory,
  InventoryWithProduct,
  InventoryAdjustment,
  InventoryFilter,
} from './types';
import type { InventoryId, ProductId, OrganizationId, Quantity } from '@/lib/types/common';

export interface InventoryRepository {
  /**
   * Get inventory record for a specific product.
   * Returns null if no inventory record exists yet.
   */
  findByProductId(productId: ProductId, organizationId: OrganizationId): Promise<Inventory | null>;

  /**
   * Get all inventory records with product details joined.
   */
  findAll(filter: InventoryFilter): Promise<InventoryWithProduct[]>;

  /**
   * Get products where quantity_on_hand is at or below reorder_level.
   */
  findLowStock(organizationId: OrganizationId): Promise<InventoryWithProduct[]>;

  /**
   * Create or update inventory record for a product.
   * Uses UPSERT: creates if doesn't exist, updates if it does.
   */
  upsert(
    organizationId: OrganizationId,
    productId: ProductId,
    quantityOnHand: Quantity
  ): Promise<Inventory>;

  /**
   * Apply a delta to the current quantity (positive = add, negative = remove).
   * Throws if resulting quantity would be negative.
   */
  adjust(
    organizationId: OrganizationId,
    productId: ProductId,
    delta: Quantity
  ): Promise<Inventory>;

  /**
   * Record an audit event for a manual inventory adjustment.
   * Phase 2: promote this to a full inventory_audit_log table.
   */
  recordAdjustment(adjustment: InventoryAdjustment): Promise<void>;
}
