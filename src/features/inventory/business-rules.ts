/**
 * INVENTORY BUSINESS RULES
 *
 * Domain logic for stock management.
 * Pure functions — no database calls.
 */

import type { Inventory, InventoryAdjustment } from './types';
import type { Quantity, Result } from '@/lib/types/common';

/**
 * Check whether current stock can fulfil a requested quantity.
 */
export function canFulfillOrder(
  inventory: Inventory,
  requestedQty: Quantity
): Result<void> {
  if (inventory.quantity_on_hand < requestedQty) {
    return {
      success: false,
      error: `Insufficient stock. On hand: ${inventory.quantity_on_hand}, requested: ${requestedQty}.`,
    };
  }
  return { success: true, data: undefined };
}

/**
 * Check whether stock is at or below a reorder threshold.
 * Returns false when reorderLevel is null (no alert configured).
 */
export function isLowStock(
  inventory: Inventory,
  reorderLevel: number | null
): boolean {
  if (reorderLevel === null) return false;
  return inventory.quantity_on_hand <= reorderLevel;
}

/**
 * Calculate the new quantity after applying a delta adjustment.
 * Returns a Result because negative stock is not allowed.
 */
export function applyAdjustment(
  current: Quantity,
  delta: Quantity
): Result<Quantity> {
  const newQty = current + delta;
  if (newQty < 0) {
    return {
      success: false,
      error: `Adjustment would result in negative stock (${current} + ${delta} = ${newQty}). Reduce the adjustment amount.`,
    };
  }
  return { success: true, data: newQty };
}

/**
 * Validate a manual inventory adjustment before applying it.
 */
export function validateAdjustment(
  inventory: Inventory,
  adjustment: Pick<InventoryAdjustment, 'quantity_delta' | 'reason' | 'notes'>
): Result<void> {
  if (adjustment.quantity_delta === 0) {
    return {
      success: false,
      error: 'Adjustment quantity cannot be zero.',
    };
  }

  const result = applyAdjustment(inventory.quantity_on_hand, adjustment.quantity_delta);
  if (!result.success) return result as Result<void>;

  if (adjustment.reason === 'other' && !adjustment.notes) {
    return {
      success: false,
      error: 'Please provide a note explaining why this adjustment was made.',
    };
  }

  return { success: true, data: undefined };
}

/**
 * Calculate the total inventory value at cost price.
 */
export function calculateInventoryValue(
  quantity: Quantity,
  costPrice: number
): number {
  return quantity * costPrice;
}
