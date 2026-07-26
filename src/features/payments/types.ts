/**
 * PAYMENT DOMAIN MODEL
 *
 * Payments are manual ledger entries recording real-world money received.
 * This is NOT a payment processor. No Stripe, PayPal, or bank integration.
 *
 * A staff member physically receives cash (or sees a bank transfer arrive)
 * and records it here. The system then updates the sale's payment status
 * and the customer's outstanding balance automatically via DB triggers.
 *
 * Design decisions:
 * - sale_id is nullable: a payment can be unallocated (advance payment, overpayment)
 * - payment_method is an enum: matches real-world payment types in the target market
 * - reference_number captures check numbers, bank transfer IDs, etc.
 * - Soft delete via deleted_at: voiding a payment is tracked, not erased
 */

import type {
  PaymentId,
  SaleId,
  CustomerId,
  OrganizationId,
  UserId,
  Timestamps,
  Auditable,
  Money,
} from '@/lib/types/common';
import type { Sale } from '@/features/sales/types';
import type { Customer } from '@/features/customers/types';

export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'check' | 'other';

export interface Payment extends Timestamps, Auditable {
  id: PaymentId;
  organization_id: OrganizationId;

  /** Human-readable number like PAY-2024-0001 */
  payment_number: string;

  customer_id: CustomerId;

  /**
   * The sale this payment is applied to.
   * null = unallocated payment (advance or overpayment to customer's account).
   */
  sale_id: SaleId | null;

  payment_date: Date;

  /** Amount received. Must be greater than zero. */
  amount: Money;

  payment_method: PaymentMethod;

  /**
   * Check number, bank transaction reference, mobile payment ID, etc.
   * Optional — not all payment methods have a reference.
   */
  reference_number: string | null;

  notes: string | null;
}

/** Input for recording a new payment */
export interface CreatePaymentInput {
  customer_id: CustomerId;
  sale_id?: SaleId;
  payment_date?: Date; // defaults to today
  amount: Money;
  payment_method: PaymentMethod;
  reference_number?: string;
  notes?: string;
}

/** Input for correcting a payment record */
export interface UpdatePaymentInput {
  payment_date?: Date;
  amount?: Money;
  payment_method?: PaymentMethod;
  reference_number?: string | null;
  notes?: string | null;
  sale_id?: SaleId | null;
}

/** Filter for querying payments */
export interface PaymentFilter {
  organization_id: OrganizationId;
  customer_id?: CustomerId;
  sale_id?: SaleId;
  payment_method?: PaymentMethod;
  date_from?: Date;
  date_to?: Date;
}

/** Payment with the sale it is applied to */
export interface PaymentWithSale extends Payment {
  sale: Pick<Sale, 'id' | 'sale_number' | 'total' | 'amount_due'> | null;
  customer: Pick<Customer, 'id' | 'name' | 'customer_code'>;
}
