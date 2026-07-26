/**
 * PRODUCT BUSINESS RULES
 *
 * Domain logic for product pricing, stock, and catalog management.
 * Pure functions — no database calls.
 */

import type { Product } from './types';
import type { Inventory } from '@/features/inventory/types';
import type { Money, Quantity, Result } from '@/lib/types/common';

// ── Pricing & Margin ──────────────────────────────────────────────────────────

/**
 * Gross profit per unit: sale_price - cost_price
 */
export function calculateProfitPerUnit(product: Product): Money {
  return product.sale_price - product.cost_price;
}

/**
 * Gross margin as a percentage of selling price.
 * Returns 0 if sale_price is 0 to avoid division by zero.
 *
 * Formula: (sale_price - cost_price) / sale_price * 100
 */
export function calculateMarginPercent(product: Product): number {
  if (product.sale_price === 0) return 0;
  return ((product.sale_price - product.cost_price) / product.sale_price) * 100;
}

/**
 * Markup as a percentage of cost price.
 * Returns 0 if cost_price is 0 (free items).
 *
 * Formula: (sale_price - cost_price) / cost_price * 100
 */
export function calculateMarkupPercent(product: Product): number {
  if (product.cost_price === 0) return 0;
  return ((product.sale_price - product.cost_price) / product.cost_price) * 100;
}

/**
 * Warn if selling price is lower than cost price (selling at a loss).
 */
export function isPricingHealthy(product: Product): Result<void> {
  if (product.sale_price < product.cost_price) {
    const loss = product.cost_price - product.sale_price;
    return {
      success: false,
      error: `Selling price is ${loss.toFixed(2)} below cost price. This product is being sold at a loss.`,
    };
  }
  return { success: true, data: undefined };
}

// ── Inventory Integration ─────────────────────────────────────────────────────

/**
 * True if the product's stock is at or below its reorder level.
 * Returns false if no reorder_level is set (Phase 2 feature).
 */
export function isLowStock(product: Product, inventory: Inventory): boolean {
  if (product.reorder_level === null) return false;
  return inventory.quantity_on_hand <= product.reorder_level;
}

/**
 * Check whether a requested quantity can be fulfilled from current stock.
 */
export function canFulfillQuantity(
  inventory: Inventory,
  requestedQty: Quantity
): Result<void> {
  if (inventory.quantity_on_hand < requestedQty) {
    return {
      success: false,
      error: `Insufficient stock. Available: ${inventory.quantity_on_hand}, requested: ${requestedQty}.`,
    };
  }
  return { success: true, data: undefined };
}

// ── SKU Generation ────────────────────────────────────────────────────────────

/**
 * Auto-generate a SKU from a product name.
 *
 * Strategy: take the first letter of each word, uppercase, max 8 chars.
 * Examples:
 *   "Sugar 50kg Bag"  → "S50KB"
 *   "Engine Oil 5L"   → "EO5L"
 *   "A4 Paper 500sht" → "A4P500S"
 */
export function generateSkuFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase())
    .join('')
    .slice(0, 8);
}

/**
 * Check whether a product is sellable:
 * must be active and have an inventory record.
 */
export function canProductBeSold(product: Product): Result<void> {
  if (!product.is_active) {
    return {
      success: false,
      error: `Product "${product.name}" is inactive and cannot be added to a sale.`,
    };
  }
  return { success: true, data: undefined };
}
