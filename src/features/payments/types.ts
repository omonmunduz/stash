/**
 * PAYMENT DOMAIN MODEL
 *
 * Payments are manual ledger entries recording real-world money received.
 * This is NOT a payment processor. No Stripe, PayPal, or bank integration.
 *
 * A staff member physically receives cash (or sees a bank transfer arrive) and
 * records it here. The system then applies it to the customer's open invoices and
 * updates their balance via DB triggers.
 *
 * Design decisions:
 * - A payment has no sale_id. Money handed across a counter does not arrive
 *   labelled with an invoice number: someone owing three invoices pays 50 and
 *   expects it to come off the oldest debt first. That is a one-payment-to-many-
 *   invoices relationship, which a single FK column cannot hold, so the split
 *   lives in PaymentAllocation rows instead.
 * - A payment may be only partly allocated, or not at all — the remainder is
 *   account credit sitting against the customer's next purchase.
 * - payment_method is an enum matching real-world payment types in the target market.
 * - reference_number captures check numbers, bank transfer IDs, etc.
 * - Soft delete via deleted_at: voiding a payment is tracked, not erased. The
 *   allocations stay too, so the audit trail still shows what it once covered.
 */

import type {
  PaymentId,
  PaymentAllocationId,
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

  /** Human-readable number like PAY-2026-0001 */
  payment_number: string;

  customer_id: CustomerId;

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

  /** Who last corrected this record. Null for a payment never edited. */
  updated_by: UserId | null;
}

/**
 * How much of one payment went toward one sale.
 *
 * Written by record_customer_payment, oldest invoice first. Never edited
 * directly by the app: correcting where money went means voiding the payment and
 * recording it again, which keeps the ledger append-only.
 */
export interface PaymentAllocation {
  id: PaymentAllocationId;
  organization_id: OrganizationId;
  payment_id: PaymentId;
  sale_id: SaleId;
  amount: Money;
  created_at: Date;
}

/** Input for recording a new payment */
export interface CreatePaymentInput {
  customer_id: CustomerId;
  amount: Money;
  payment_method: PaymentMethod;
  payment_date?: Date; // defaults to today
  reference_number?: string;
  notes?: string;
  /**
   * Settle this invoice before applying the rest oldest-first. Set when the user
   * paid from a specific invoice's screen; left undefined for a payment against
   * the tab as a whole.
   */
  sale_id?: SaleId;
}

/**
 * Input for correcting a payment record.
 *
 * `amount` is editable: she wrote 50 and it was really 30, and that is a typo to
 * fix rather than a reason to void a receipt the customer already has. Correcting
 * it goes through update_payment_amount, which discards this payment's
 * allocations and re-runs oldest-debt-first for the whole customer, so the
 * invoices it was covering end up where the corrected money actually reaches.
 * Metadata-only edits take the plain UPDATE path instead.
 */
export interface UpdatePaymentInput {
  amount?: Money;
  payment_date?: Date;
  payment_method?: PaymentMethod;
  reference_number?: string | null;
  notes?: string | null;
}

/** Filter for querying payments */
export interface PaymentFilter {
  organization_id: OrganizationId;
  customer_id?: CustomerId;
  payment_method?: PaymentMethod;
  date_from?: Date;
  date_to?: Date;
}

/**
 * A payment with the invoices it was applied to, and how much is still floating
 * as account credit.
 */
export interface PaymentWithAllocations extends Payment {
  allocations: Array<{
    sale_id: SaleId;
    /** Null while the sale is still a draft. */
    sale_number: string | null;
    amount: Money;
  }>;
  /** amount − sum(allocations). Zero for a payment that fully landed on invoices. */
  unallocated_amount: Money;
}

/** Payment with customer context — for a payments list or receipt view. */
export interface PaymentWithCustomer extends PaymentWithAllocations {
  customer: Pick<Customer, 'id' | 'name' | 'customer_code'>;
}

/** A payment as it appears on a sale's invoice view. */
export type SalePaymentLine = Pick<Sale, 'id' | 'sale_number'> & {
  applied: Money;
};
