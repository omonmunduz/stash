/**
 * CUSTOMER BUSINESS RULES
 *
 * Domain logic for credit management and customer operations.
 * These are pure functions — no database calls, no side effects.
 */

import type { Customer } from './types';
import type { Money, Result } from '@/lib/types/common';

// ── Credit Logic ─────────────────────────────────────────────────────────────

/**
 * Returns how much credit the customer has remaining.
 * Returns Infinity when no credit limit is set (unlimited credit).
 */
export function availableCredit(customer: Customer): number {
  if (customer.credit_limit === null) return Infinity;
  return Math.max(0, customer.credit_limit - customer.current_balance);
}

/**
 * Check whether a new sale amount would exceed the customer's credit limit.
 *
 * Business rule: current_balance + new_sale_total must not exceed credit_limit.
 * A null credit_limit means no enforcement.
 */
export function isWithinCreditLimit(customer: Customer, additionalAmount: Money): boolean {
  if (customer.credit_limit === null) return true;
  return customer.current_balance + additionalAmount <= customer.credit_limit;
}

/**
 * Validate that a sale can be created for this customer.
 * Returns a warning (not a hard block) when limit is exceeded,
 * because managers may override for trusted customers.
 */
export function checkCreditForSale(
  customer: Customer,
  saleTotal: Money
): Result<void, { message: string; isSoftWarning: boolean }> {
  if (!customer.is_active) {
    return {
      success: false,
      error: {
        message: `Customer "${customer.name}" is inactive. Reactivate them before creating a sale.`,
        isSoftWarning: false,
      },
    };
  }

  if (!isWithinCreditLimit(customer, saleTotal)) {
    const over = customer.current_balance + saleTotal - (customer.credit_limit ?? 0);
    return {
      success: false,
      error: {
        message: `This sale would exceed ${customer.name}'s credit limit by ${over.toFixed(2)}. Available: ${availableCredit(customer).toFixed(2)}.`,
        isSoftWarning: true, // Manager can override
      },
    };
  }

  return { success: true, data: undefined };
}

/**
 * True if the customer has any outstanding balance.
 */
export function hasOutstandingBalance(customer: Customer): boolean {
  return customer.current_balance > 0;
}

// ── Code Generation ───────────────────────────────────────────────────────────

/**
 * Generate a human-readable customer code from a sequential number.
 *
 * Examples:
 *   1  → "CUST-0001"
 *   42 → "CUST-0042"
 *   1000 → "CUST-1000"
 */
export function generateCustomerCode(sequenceNumber: number): string {
  return `CUST-${String(sequenceNumber).padStart(4, '0')}`;
}

/**
 * Parse the numeric sequence from a customer code.
 * Returns null if the code does not match expected format.
 */
export function parseCustomerCodeSequence(code: string): number | null {
  const match = code.match(/^CUST-(\d+)$/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

// ── Display Helpers ───────────────────────────────────────────────────────────

/**
 * Return the best display name for a customer.
 * Prefers business_name if set, falls back to name.
 */
export function getCustomerDisplayName(customer: Customer): string {
  return customer.business_name ?? customer.name;
}

/**
 * Return a one-line summary of a customer's debt status.
 */
export function getDebtStatusLabel(customer: Customer): string {
  if (customer.current_balance <= 0) return 'No outstanding balance';
  const limit = customer.credit_limit;
  if (limit === null) return `Owes ${customer.current_balance.toFixed(2)} (no limit)`;
  const pct = Math.round((customer.current_balance / limit) * 100);
  return `Owes ${customer.current_balance.toFixed(2)} of ${limit.toFixed(2)} limit (${pct}%)`;
}
