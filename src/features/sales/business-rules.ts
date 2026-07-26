/**
 * SALE BUSINESS RULES
 *
 * Domain logic for sales workflow and calculations.
 * Pure functions — no database calls.
 */

import type { Sale, SaleItem, SaleStatus, SalePaymentStatus, AddSaleItemInput } from './types';
import type { Customer } from '@/features/customers/types';
import type { Product } from '@/features/products/types';
import type { Inventory } from '@/features/inventory/types';
import type { Money, Quantity, Result } from '@/lib/types/common';

// ── Sale Number Generation ────────────────────────────────────────────────────

/**
 * Generate a human-readable sale number.
 * Format: INV-YYYY-NNNN
 * Example: INV-2024-0001
 */
export function generateSaleNumber(sequenceNumber: number, year?: number): string {
  const y = year ?? new Date().getFullYear();
  return `INV-${y}-${String(sequenceNumber).padStart(4, '0')}`;
}

// ── Item & Total Calculations ─────────────────────────────────────────────────

/**
 * Calculate the subtotal for a single sale item.
 * Formula: (quantity × unit_price) − discount
 */
export function calculateItemSubtotal(
  quantity: Quantity,
  unitPrice: Money,
  discount: Money = 0
): Money {
  return quantity * unitPrice - discount;
}

/**
 * Calculate gross profit for a single sale item.
 * Formula: (unit_price − cost_price) × quantity
 *
 * Note: discount is subtracted from revenue, not cost.
 * This matches accounting convention: discounts reduce revenue.
 */
export function calculateItemGrossProfit(item: SaleItem): Money {
  const revenuePerUnit = item.unit_price - item.discount / item.quantity;
  return (revenuePerUnit - item.cost_price) * item.quantity;
}

/**
 * Calculate total gross profit across all items in a sale.
 * Gross profit = Revenue − Cost of Goods Sold
 */
export function calculateSaleGrossProfit(items: SaleItem[]): Money {
  return items.reduce((sum, item) => sum + calculateItemGrossProfit(item), 0);
}

/**
 * Calculate gross margin percentage for a sale.
 * Returns 0 if total revenue is zero.
 */
export function calculateSaleGrossMargin(items: SaleItem[], saleTotal: Money): number {
  if (saleTotal === 0) return 0;
  return (calculateSaleGrossProfit(items) / saleTotal) * 100;
}

/**
 * Calculate sale totals from line items, tax, and sale-level discount.
 * Returns: { subtotal, total }
 */
export function calculateSaleTotals(
  items: SaleItem[],
  tax: Money,
  saleDiscount: Money
): { subtotal: Money; total: Money } {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const total = subtotal + tax - saleDiscount;
  return { subtotal, total };
}

/**
 * Derive payment status from total and amount paid.
 * This function matches the database trigger logic.
 */
export function getSalePaymentStatus(total: Money, amountPaid: Money): SalePaymentStatus {
  const amountDue = total - amountPaid;
  if (amountDue <= 0) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
}

// ── Sale Lifecycle Validations ───────────────────────────────────────────────

/**
 * Validate that a sale can be completed (changed from draft to completed).
 *
 * Rules:
 * 1. Sale must be in 'draft' status
 * 2. Sale must have at least one line item
 * 3. Sufficient inventory must exist for all items
 * 4. Customer must be active
 */
export function canCompleteSale(
  sale: Sale,
  items: SaleItem[],
  customer: Customer,
  inventoryMap: Map<string, Inventory>
): Result<void> {
  if (sale.status !== 'draft') {
    return {
      success: false,
      error: `Sale is already ${sale.status}. Only draft sales can be completed.`,
    };
  }

  if (items.length === 0) {
    return {
      success: false,
      error: 'Sale must have at least one item before it can be completed.',
    };
  }

  if (!customer.is_active) {
    return {
      success: false,
      error: `Customer "${customer.name}" is inactive. Reactivate them before completing this sale.`,
    };
  }

  // Check inventory for each item
  for (const item of items) {
    const inventory = inventoryMap.get(item.product_id);
    if (!inventory) {
      return {
        success: false,
        error: `No inventory record found for product "${item.product_name}".`,
      };
    }
    if (inventory.quantity_on_hand < item.quantity) {
      return {
        success: false,
        error: `Insufficient stock for "${item.product_name}". Available: ${inventory.quantity_on_hand}, needed: ${item.quantity}.`,
      };
    }
  }

  return { success: true, data: undefined };
}

/**
 * Validate that a sale can be cancelled.
 *
 * Rules:
 * 1. Sale must not already be cancelled
 * 2. If sale is completed and has payments, warn but allow (manager override)
 */
export function canCancelSale(sale: Sale): Result<void, { message: string; isSoftWarning: boolean }> {
  if (sale.status === 'cancelled') {
    return {
      success: false,
      error: { message: 'Sale is already cancelled.', isSoftWarning: false },
    };
  }

  if (sale.status === 'completed' && sale.amount_paid > 0) {
    return {
      success: false,
      error: {
        message: `This sale has received payments (${sale.amount_paid.toFixed(2)}). Cancelling will reverse inventory but payments must be voided separately.`,
        isSoftWarning: true, // Manager can override
      },
    };
  }

  return { success: true, data: undefined };
}

/**
 * Validate that an item can be added to a sale.
 */
export function canAddItem(
  sale: Sale,
  input: AddSaleItemInput,
  product: Product
): Result<void> {
  if (sale.status !== 'draft') {
    return {
      success: false,
      error: `Cannot add items to a ${sale.status} sale. Only draft sales can be edited.`,
    };
  }

  if (!product.is_active) {
    return {
      success: false,
      error: `Product "${product.name}" is inactive and cannot be added to a sale.`,
    };
  }

  if (input.quantity <= 0) {
    return {
      success: false,
      error: 'Quantity must be greater than zero.',
    };
  }

  return { success: true, data: undefined };
}

// ── Status Checks ─────────────────────────────────────────────────────────────

/**
 * True if the sale is overdue: has a due_date in the past and is not fully paid.
 */
export function isOverdue(sale: Sale): boolean {
  if (!sale.due_date) return false;
  if (sale.payment_status === 'paid') return false;
  return sale.due_date < new Date();
}

/**
 * True if the sale is a credit sale (amount due > 0 after completion).
 */
export function isCreditSale(sale: Sale): boolean {
  return sale.status === 'completed' && sale.amount_due > 0;
}
