/**
 * INVENTORY SERVICE
 *
 * Orchestrates all inventory operations.
 * The UI calls this service — never the repository directly.
 *
 * Key responsibilities:
 * - Manual stock adjustments with validation and audit
 * - Pre-flight sale completion checks
 * - Low stock reporting
 * - Inventory value calculations
 *
 * Note: Automatic inventory changes (sale completion/cancellation) are
 * handled by DB triggers. This service covers everything else.
 */

import type { InventoryRepository } from './repository';
import type {
  Inventory,
  InventoryWithProduct,
  InventoryAdjustment,
  InventoryAdjustmentReason,
  InventoryFilter,
} from './types';
import type { ProductId, OrganizationId, Result } from '@/lib/types/common';
import {
  canFulfillOrder,
  applyAdjustment,
  validateAdjustment,
  isLowStock,
  calculateInventoryValue,
} from './business-rules';

export class InventoryService {
  constructor(
    private repo: InventoryRepository,
    private orgId: OrganizationId
  ) {}

  /** Get inventory for a specific product. Returns null if not initialized. */
  async getForProduct(productId: ProductId): Promise<Inventory | null> {
    return this.repo.findByProductId(productId, this.orgId);
  }

  /** List all inventory records with product details. */
  async listAll(filter?: Omit<InventoryFilter, 'organization_id'>): Promise<InventoryWithProduct[]> {
    return this.repo.findAll({ ...filter, organization_id: this.orgId });
  }

  /** Get products that are at or below their reorder level. */
  async getLowStockProducts(): Promise<InventoryWithProduct[]> {
    const all = await this.repo.findAll({ organization_id: this.orgId });
    return all.filter((item) => isLowStock(item, item.product.reorder_level));
  }

  /** Get the count of low-stock products (for dashboard badge). */
  async getLowStockCount(): Promise<number> {
    const items = await this.getLowStockProducts();
    return items.length;
  }

  /**
   * Calculate the total inventory value at current cost prices.
   * total_value = SUM(quantity_on_hand × cost_price) for all products
   */
  async getTotalInventoryValue(): Promise<number> {
    const all = await this.repo.findAll({ organization_id: this.orgId });
    return all.reduce(
      (sum, item) => sum + calculateInventoryValue(item.quantity_on_hand, item.product.cost_price),
      0
    );
  }

  /**
   * Manually adjust inventory for a product.
   *
   * Use for:
   * - Receiving stock from suppliers (+)
   * - Writing off damaged/lost goods (-)
   * - Correcting count discrepancies (+/-)
   * - Initial stock setup (+)
   *
   * The delta can be positive (add stock) or negative (remove stock).
   * Negative deltas that would create negative stock are rejected.
   */
  async adjustInventory(
    productId: ProductId,
    delta: number,
    reason: InventoryAdjustmentReason,
    notes: string | undefined,
    adjustedBy: string
  ): Promise<Result<Inventory>> {
    const current = await this.repo.findByProductId(productId, this.orgId);

    if (!current) {
      return {
        success: false,
        error: 'No inventory record found for this product. Add initial stock first.',
      };
    }

    // Validate the adjustment using business rules
    const validation = validateAdjustment(current, { quantity_delta: delta, reason, notes });
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    // Apply adjustment through repository
    const updated = await this.repo.adjust(this.orgId, productId, delta);

    // Log the adjustment for audit trail
    await this.repo.recordAdjustment({
      product_id: productId,
      organization_id: this.orgId,
      quantity_delta: delta,
      reason,
      notes,
      adjusted_by: adjustedBy as any,
      adjusted_at: new Date(),
    });

    return { success: true, data: updated };
  }

  /**
   * Set inventory to an absolute value (from physical count).
   * Calculates the delta internally and records it as a count_correction.
   */
  async setInventory(
    productId: ProductId,
    newQuantity: number,
    notes: string | undefined,
    adjustedBy: string
  ): Promise<Result<Inventory>> {
    if (newQuantity < 0) {
      return { success: false, error: 'Inventory quantity cannot be negative.' };
    }

    const current = await this.repo.findByProductId(productId, this.orgId);
    const currentQty = current?.quantity_on_hand ?? 0;
    const delta = newQuantity - currentQty;

    if (delta === 0) {
      return { success: false, error: 'New quantity is the same as current quantity. No adjustment needed.' };
    }

    return this.adjustInventory(productId, delta, 'count_correction', notes, adjustedBy);
  }

  /**
   * Pre-flight check: can a sale be completed given current inventory?
   * Returns a list of products with insufficient stock.
   *
   * Call this before attempting to complete a sale to show user-friendly errors.
   */
  async checkSaleInventory(
    items: Array<{ product_id: ProductId; product_name: string; quantity: number }>
  ): Promise<{ canComplete: boolean; shortages: Array<{ product_name: string; available: number; needed: number }> }> {
    const shortages: Array<{ product_name: string; available: number; needed: number }> = [];

    for (const item of items) {
      const inventory = await this.repo.findByProductId(item.product_id, this.orgId);
      const available = inventory?.quantity_on_hand ?? 0;

      if (available < item.quantity) {
        shortages.push({
          product_name: item.product_name,
          available,
          needed: item.quantity,
        });
      }
    }

    return { canComplete: shortages.length === 0, shortages };
  }
}
