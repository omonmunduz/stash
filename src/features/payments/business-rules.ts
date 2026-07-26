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
 * 3. If linked to a sale, the sale must belong to the same customer.
 * 4. Warn (soft) if amount exceeds what is owed on the sale.
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

    if (input.amount > sale.amount_due) {
      return {
        success: false,
        error: {
          message: `Payment (${input.amount.toFixed(2)}) exceeds the amount due (${sale.amount_due.toFixed(2)}). The excess will create an overpayment credit.`,
          isSoftWarning: true, // Manager may allow
        },
      };
    }
  }

  return { success: true, data: undefined };
}

/**
 * True when the payment is not linked to any specific sale.
 * Unallocated payments represent advance payments or account credits.
 */
export function isUnallocatedPayment(payment: Payment): boolean {
  return payment.sale_id === null;
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
