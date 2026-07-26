/**
 * PAYMENT REPOSITORY INTERFACE
 */

import type {
  Payment,
  PaymentWithSale,
  CreatePaymentInput,
  UpdatePaymentInput,
  PaymentFilter,
} from './types';
import type { PaymentId, SaleId, CustomerId, OrganizationId, Money } from '@/lib/types/common';

export interface PaymentRepository {
  /** Find a payment by ID. */
  findById(id: PaymentId): Promise<Payment | null>;

  /** List payments with optional filtering. */
  findAll(filter: PaymentFilter): Promise<Payment[]>;

  /** List payments for a specific customer, including sale details. */
  findByCustomer(customerId: CustomerId, organizationId: OrganizationId): Promise<PaymentWithSale[]>;

  /** List payments applied to a specific sale. */
  findBySale(saleId: SaleId, organizationId: OrganizationId): Promise<Payment[]>;

  /**
   * Sum all payments received from a customer.
   * Used in customer balance reconciliation.
   */
  sumByCustomer(customerId: CustomerId, organizationId: OrganizationId): Promise<Money>;

  /**
   * Sum all payments applied to a specific sale.
   * Used to verify denormalized sale.amount_paid is correct.
   */
  sumBySale(saleId: SaleId): Promise<Money>;

  /**
   * Create a payment record.
   * This also triggers a DB trigger that updates:
   * - sale.amount_paid, sale.amount_due, sale.payment_status
   * - customer.current_balance
   */
  create(organizationId: OrganizationId, input: CreatePaymentInput): Promise<Payment>;

  /**
   * Update a payment record (correction only — amount changes update denormalized fields).
   */
  update(id: PaymentId, input: UpdatePaymentInput): Promise<Payment>;

  /**
   * Soft-delete (void) a payment.
   * DB trigger reverses the effect on sale and customer balance.
   */
  delete(id: PaymentId): Promise<void>;

  /**
   * Get the next sequence number for payment_number generation.
   */
  getNextSequenceNumber(organizationId: OrganizationId, year?: number): Promise<number>;
}
