/**
 * PAYMENT BUSINESS RULES
 *
 * Domain logic for manual payment recording.
 * Payments are ledger entries — no payment processing involved.
 * Pure functions — no database calls.
 */

import type { Payment, CreatePaymentInput } from './types';
import type { Sale } from '@/features/sales/types';
import type { Customer } from '@/features/customers/types';
import type { Money, Result } from '@/lib/types/common';

/**
 * Validate that a payment can be recorded.
 *
 * Rules:
 * 1. Amount must be positive.
 * 2. Customer must be active.
 * 3. If aimed at a specific sale, that sale must belong to the same customer.
 * 4. Warn (soft) if the amount exceeds the whole tab — the excess becomes credit.
 *
 * Paying more than one invoice's balance is NOT a warning: the surplus rolls onto
 * the customer's other open invoices, which is the normal case for someone
 * clearing several weeks of small purchases with one note.
 */
export function canRecordPayment(
  input: Pick<CreatePaymentInput, 'amount'>,
  customer: Customer,
  sale: Sale | null
): Result<void, { message: string; isSoftWarning: boolean }> {
  if (input.amount <= 0) {
    return {
      success: false,
      error: { message: 'Payment amount must be greater than zero.', isSoftWarning: false },
    };
  }

  if (!customer.is_active) {
    return {
      success: false,
      error: {
        message: `Customer "${customer.name}" is inactive. Payments cannot be recorded.`,
        isSoftWarning: false,
      },
    };
  }

  if (sale) {
    if (sale.customer_id !== customer.id) {
      return {
        success: false,
        error: {
          message: 'This sale does not belong to the selected customer.',
          isSoftWarning: false,
        },
      };
    }

    if (sale.status === 'cancelled') {
      return {
        success: false,
        error: {
          message: 'Cannot record a payment against a cancelled sale.',
          isSoftWarning: false,
        },
      };
    }

  }

  // Compared against the customer's whole balance, not one invoice. Overshooting
  // a single invoice is routine; overshooting everything they owe means the shop
  // is now holding money it will have to remember, so it is worth a confirmation.
  if (customer.current_balance > 0 && input.amount > customer.current_balance) {
    return {
      success: false,
      error: {
        message: `Payment (${input.amount.toFixed(2)}) is more than the ${customer.current_balance.toFixed(2)} owed. The extra ${(input.amount - customer.current_balance).toFixed(2)} will be kept as credit on their account.`,
        isSoftWarning: true,
      },
    };
  }

  return { success: true, data: undefined };
}

/**
 * How much of a payment is sitting as account credit rather than against an
 * invoice.
 *
 * Non-zero in two ordinary situations: the customer paid more than they owed, or
 * they paid in advance of buying anything. Both mean the shop is holding their
 * money, so it shows on the tab as credit instead of vanishing into a settled
 * invoice.
 */
export function getUnallocatedAmount(
  payment: Pick<Payment, 'amount'>,
  allocations: Array<{ amount: Money }>
): Money {
  const applied = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  // Guarded against a negative: allocations can never exceed the payment (the
  // RPC slices from a shrinking remainder), but a rounding artefact should read
  // as zero credit rather than as the shop owing the customer money.
  return Math.max(0, payment.amount - applied);
}

/**
 * True when none of the payment landed on an invoice — a pure advance payment.
 */
export function isFullyUnallocated(allocations: Array<{ amount: Money }>): boolean {
  return allocations.length === 0;
}

/**
 * Generate a payment number from a sequence.
 * Format: PAY-YYYY-NNNN
 */
export function generatePaymentNumber(sequenceNumber: number, year?: number): string {
  const y = year ?? new Date().getFullYear();
  return `PAY-${y}-${String(sequenceNumber).padStart(4, '0')}`;
}

/**
 * Get a human-readable label for a payment method.
 */
export function getPaymentMethodLabel(method: Payment['payment_method']): string {
  const labels: Record<Payment['payment_method'], string> = {
    cash: 'Cash',
    card: 'Card',
    bank_transfer: 'Bank Transfer',
    check: 'Check',
    other: 'Other',
  };
  return labels[method];
}
