/**
 * PAYMENT SERVICE
 *
 * Orchestrates payment recording. Server Actions call this; they never touch the
 * repository directly.
 *
 * Responsibilities that live here rather than in the repository:
 * - Input validation (Zod)
 * - Confirming the customer exists in this organization and is active
 * - Confirming a targeted sale belongs to that same customer
 * - Turning thrown repository errors into Result values
 *
 * Allocation itself is not here. Deciding which invoices the money clears has to
 * happen inside the same transaction that inserts the payment, or two people
 * taking money for the same customer at once will both allocate against the same
 * open invoices. That lives in record_customer_payment.
 */

import type { PaymentRepository } from './repository';
import type { CustomerRepository } from '@/features/customers/repository';
import type { SaleRepository } from '@/features/sales/repository';
import type {
  Payment,
  PaymentWithAllocations,
  PaymentFilter,
  PaymentMethod,
} from './types';
import type { PaymentId, CustomerId, SaleId, OrganizationId, Result } from '@/lib/types/common';
import { createPaymentSchema, updatePaymentSchema } from './schemas';
import { canRecordPayment } from './business-rules';
import { brandId } from '@/lib/types/common';

/** Shape a payments query filters by. */
export interface PaymentListOptions {
  customerId?: CustomerId;
  method?: PaymentMethod;
  dateFrom?: Date;
  dateTo?: Date;
}

/** A recorded payment, plus anything the user should know about it. */
export interface RecordPaymentResult {
  payment: PaymentWithAllocations;
  /**
   * Set when the payment was more than the customer owed. Not an error — the
   * money has been handed over, and refusing to record it would be worse than
   * carrying the surplus as credit.
   */
  creditNotice?: string;
}

export class PaymentService {
  constructor(
    private repo: PaymentRepository,
    private customerRepo: CustomerRepository,
    private saleRepo: SaleRepository,
    private orgId: OrganizationId
  ) {}

  /** List payments, newest first. */
  async list(options: PaymentListOptions = {}): Promise<Result<Payment[]>> {
    const filter: PaymentFilter = {
      organization_id: this.orgId,
      customer_id: options.customerId,
      payment_method: options.method,
      date_from: options.dateFrom,
      date_to: options.dateTo,
    };

    try {
      return { success: true, data: await this.repo.findAll(filter) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load payments.') };
    }
  }

  /** A customer's payment history with the invoices each payment cleared. */
  async listByCustomer(customerId: CustomerId): Promise<Result<PaymentWithAllocations[]>> {
    try {
      return { success: true, data: await this.repo.findByCustomer(customerId, this.orgId) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load payment history.') };
    }
  }

  /**
   * Record a payment against a customer's tab.
   *
   * The money is applied to their open invoices oldest-first. Anything left over
   * stays on the account as credit and comes off their next purchase.
   */
  async record(input: unknown): Promise<Result<RecordPaymentResult>> {
    const parsed = createPaymentSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }

    const customerId = brandId<'CustomerId'>(parsed.data.customer_id);
    const customer = await this.customerRepo.findById(customerId);

    if (!customer || customer.organization_id !== this.orgId) {
      return { success: false, error: 'Customer not found.' };
    }

    // A sale_id means the user recorded this from one invoice's screen, so that
    // invoice is settled before the rest goes oldest-first. Verified here rather
    // than trusting the form field, since it arrives from the client.
    let sale = null;

    if (parsed.data.sale_id) {
      sale = await this.saleRepo.findById(brandId<'SaleId'>(parsed.data.sale_id));

      if (!sale || sale.organization_id !== this.orgId) {
        return { success: false, error: 'That sale could not be found.' };
      }
    }

    const check = canRecordPayment({ amount: parsed.data.amount }, customer, sale);

    // A hard failure blocks the payment. A soft warning (paying more than the
    // whole tab) does not: it is information, and the surplus is handled.
    if (!check.success && !check.error.isSoftWarning) {
      return { success: false, error: check.error.message };
    }

    try {
      const payment = await this.repo.create(this.orgId, {
        customer_id: customerId,
        amount: parsed.data.amount,
        payment_method: parsed.data.payment_method,
        payment_date: parsed.data.payment_date,
        reference_number: parsed.data.reference_number,
        notes: parsed.data.notes,
        sale_id: parsed.data.sale_id ? brandId<'SaleId'>(parsed.data.sale_id) : undefined,
      });

      return {
        success: true,
        data: {
          payment,
          creditNotice:
            payment.unallocated_amount > 0
              ? `${payment.unallocated_amount.toFixed(2)} of this payment is being held as credit on ${customer.name}'s account.`
              : undefined,
        },
      };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not record the payment.') };
    }
  }

  /** Correct a payment's date, method, reference, or notes. */
  async update(id: PaymentId, input: unknown): Promise<Result<Payment>> {
    const parsed = updatePaymentSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }

    const existing = await this.getById(id);
    if (!existing.success) return existing;

    try {
      return { success: true, data: await this.repo.update(id, parsed.data) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not update the payment.') };
    }
  }

  /** Load one payment, confirming tenancy. */
  async getById(id: PaymentId): Promise<Result<Payment>> {
    try {
      const payment = await this.repo.findById(id);

      if (!payment || payment.organization_id !== this.orgId) {
        return { success: false, error: 'Payment not found.' };
      }

      return { success: true, data: payment };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load payment.') };
    }
  }

  /**
   * Void a payment. The invoices it was covering go back to unpaid or partial and
   * the customer's balance rises again.
   */
  async void(id: PaymentId): Promise<Result<void>> {
    const existing = await this.getById(id);
    if (!existing.success) return existing;

    try {
      await this.repo.delete(id);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not void the payment.') };
    }
  }
}

// ── Internals ─────────────────────────────────────────────────────────────────

function firstIssue(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}

function toMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  // Raised by record_customer_payment's own guards, which are already worded for
  // a person.
  if (error.message.includes('Payment amount must be greater than zero')) {
    return 'Payment amount must be greater than zero.';
  }

  if (error.message.includes('does not belong to')) {
    return 'That record belongs to another organization.';
  }

  if (error.message.includes('row-level security')) {
    return 'You do not have permission to do that.';
  }

  return fallback;
}
