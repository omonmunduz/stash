/**
 * PAYMENT REPOSITORY
 *
 * Interface plus the Supabase implementation.
 *
 * create() is a single RPC rather than an insert. Recording a payment means:
 * generate a number, insert the ledger row, then walk the customer's open
 * invoices oldest-first inserting allocation slices until the money runs out.
 * Done from here, two staff recording payments for the same customer at the same
 * moment would both read the same set of open invoices and both allocate against
 * it, double-paying one invoice and leaving another open. record_customer_payment
 * takes a row lock on the customer, so the second caller waits and sees the first
 * one's effect.
 */

import type {
  Payment,
  PaymentAllocation,
  PaymentWithAllocations,
  CreatePaymentInput,
  UpdatePaymentInput,
  PaymentFilter,
} from './types';
import type { PaymentId, SaleId, CustomerId, OrganizationId, Money } from '@/lib/types/common';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';
import { mapPayment, mapPaymentAllocation } from './mapper';
import { getUnallocatedAmount } from './business-rules';
import {
  PAYMENT_COLUMNS,
  ALLOCATION_COLUMNS,
  paymentsBaseQuery,
  paymentsByCustomerQuery,
  allocationsForPaymentsQuery,
} from './queries';
import { TRANSACTION_LIST_LIMIT } from '@/lib/constants/query-limits';

type PaymentUpdate = Database['public']['Tables']['payments']['Update'];

export interface PaymentRepository {
  /** Find a payment by ID. Returns null if not found or voided. */
  findById(id: PaymentId): Promise<Payment | null>;

  /** List payments with optional filtering, newest first. */
  findAll(filter: PaymentFilter): Promise<Payment[]>;

  /** A customer's payments with the invoices each one was applied to. */
  findByCustomer(
    customerId: CustomerId,
    organizationId: OrganizationId
  ): Promise<PaymentWithAllocations[]>;

  /** Allocations landing on one sale. */
  findAllocationsBySale(
    saleId: SaleId,
    organizationId: OrganizationId
  ): Promise<PaymentAllocation[]>;

  /** Sum of a customer's non-voided payments. For balance reconciliation. */
  sumByCustomer(customerId: CustomerId, organizationId: OrganizationId): Promise<Money>;

  /** Sum allocated to one sale. Verifies the denormalized sale.amount_paid. */
  sumBySale(saleId: SaleId, organizationId: OrganizationId): Promise<Money>;

  /**
   * Record a payment and apply it to open invoices oldest-first.
   * Returns the payment with the allocations it produced.
   */
  create(
    organizationId: OrganizationId,
    input: CreatePaymentInput
  ): Promise<PaymentWithAllocations>;

  /**
   * Correct a payment. Metadata is a plain patch; `amount` goes through
   * update_payment_amount, which rebuilds the customer's allocations oldest-first
   * so the invoices this payment was covering end up matching the new figure.
   */
  update(
    organizationId: OrganizationId,
    id: PaymentId,
    input: UpdatePaymentInput
  ): Promise<Payment>;

  /**
   * Void a payment. Triggers un-pay the invoices it was covering and the
   * customer's balance goes back up.
   */
  delete(id: PaymentId): Promise<void>;
}

/**
 * Supabase-backed payment repository. Reads that find nothing return null or an
 * empty collection; anything else throws for the service to translate.
 */
export class SupabasePaymentRepository implements PaymentRepository {
  constructor(private supabase: SupabaseServerClient) {}

  async findById(id: PaymentId): Promise<Payment | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select(PAYMENT_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to load payment: ${error.message}`);
    return data ? mapPayment(data) : null;
  }

  async findAll(filter: PaymentFilter): Promise<Payment[]> {
    let query = paymentsBaseQuery(this.supabase, filter.organization_id);

    if (filter.customer_id) query = query.eq('customer_id', filter.customer_id);
    if (filter.payment_method) query = query.eq('payment_method', filter.payment_method);
    if (filter.date_from) query = query.gte('payment_date', toDateOnly(filter.date_from));
    if (filter.date_to) query = query.lte('payment_date', toDateOnly(filter.date_to));

    // Bound on the worst case, not pagination. The sort is newest-first, so the
    // rows this drops are the oldest. See lib/constants/query-limits.
    const { data, error } = await query
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(TRANSACTION_LIST_LIMIT);

    if (error) throw new Error(`Failed to list payments: ${error.message}`);
    return (data ?? []).map(mapPayment);
  }

  async findByCustomer(
    customerId: CustomerId,
    organizationId: OrganizationId
  ): Promise<PaymentWithAllocations[]> {
    const { data, error } = await paymentsByCustomerQuery(
      this.supabase,
      organizationId,
      customerId
    );

    if (error) throw new Error(`Failed to load customer payments: ${error.message}`);

    const payments = (data ?? []).map(mapPayment);
    if (payments.length === 0) return [];

    // One batched allocation query for the whole page rather than one per
    // payment. A customer with a year of weekly payments would otherwise issue
    // fifty round trips to render one screen.
    const { data: allocationRows, error: allocationError } = await allocationsForPaymentsQuery(
      this.supabase,
      organizationId,
      payments.map((payment) => payment.id)
    );

    if (allocationError) {
      throw new Error(`Failed to load payment allocations: ${allocationError.message}`);
    }

    const byPayment = new Map<string, PaymentWithAllocations['allocations']>();
    for (const row of allocationRows ?? []) {
      const entry = byPayment.get(row.payment_id) ?? [];
      entry.push({
        sale_id: row.sale_id as SaleId,
        sale_number: row.sale?.sale_number ?? null,
        amount: row.amount,
      });
      byPayment.set(row.payment_id, entry);
    }

    return payments.map((payment) => {
      const allocations = byPayment.get(payment.id) ?? [];
      return {
        ...payment,
        allocations,
        unallocated_amount: getUnallocatedAmount(payment, allocations),
      };
    });
  }

  async findAllocationsBySale(
    saleId: SaleId,
    organizationId: OrganizationId
  ): Promise<PaymentAllocation[]> {
    const { data, error } = await this.supabase
      .from('payment_allocations')
      .select(ALLOCATION_COLUMNS)
      .eq('organization_id', organizationId)
      .eq('sale_id', saleId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to load sale allocations: ${error.message}`);
    return (data ?? []).map(mapPaymentAllocation);
  }

  async sumByCustomer(
    customerId: CustomerId,
    organizationId: OrganizationId
  ): Promise<Money> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('amount')
      .eq('organization_id', organizationId)
      .eq('customer_id', customerId)
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to sum customer payments: ${error.message}`);
    return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
  }

  async sumBySale(saleId: SaleId, organizationId: OrganizationId): Promise<Money> {
    // Joins to payments so a voided payment's allocations stop counting. The
    // allocation rows survive the void for audit, so summing them alone would
    // report an invoice as paid by money that was taken back.
    const { data, error } = await this.supabase
      .from('payment_allocations')
      .select('amount, payment:payments!inner ( deleted_at )')
      .eq('organization_id', organizationId)
      .eq('sale_id', saleId)
      .is('payment.deleted_at', null);

    if (error) throw new Error(`Failed to sum sale payments: ${error.message}`);
    return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
  }

  async create(
    organizationId: OrganizationId,
    input: CreatePaymentInput
  ): Promise<PaymentWithAllocations> {
    const { data: paymentId, error } = await this.supabase.rpc('record_customer_payment', {
      p_organization_id: organizationId,
      p_customer_id: input.customer_id,
      p_amount: input.amount,
      p_payment_method: input.payment_method,
      p_payment_date: toDateOnly(input.payment_date ?? new Date()),
      // All three are DEFAULT NULL in the function. Omitting is equivalent, and a
      // missing p_sale_id is what makes the payment go against the whole tab
      // oldest-first rather than one named invoice.
      p_reference_number: input.reference_number ?? undefined,
      p_notes: input.notes ?? undefined,
      p_sale_id: input.sale_id ?? undefined,
    });

    if (error) throw new Error(`Failed to record payment: ${error.message}`);
    if (!paymentId) throw new Error('Failed to record payment: no payment ID returned.');

    const payment = await this.findById(paymentId as PaymentId);
    if (!payment) throw new Error('Payment was recorded but could not be read back.');

    const { data: allocationRows, error: allocationError } = await allocationsForPaymentsQuery(
      this.supabase,
      organizationId,
      [payment.id]
    );

    if (allocationError) {
      throw new Error(`Failed to load new payment allocations: ${allocationError.message}`);
    }

    const allocations = (allocationRows ?? []).map((row) => ({
      sale_id: row.sale_id as SaleId,
      sale_number: row.sale?.sale_number ?? null,
      amount: row.amount,
    }));

    return {
      ...payment,
      allocations,
      unallocated_amount: getUnallocatedAmount(payment, allocations),
    };
  }

  async update(
    organizationId: OrganizationId,
    id: PaymentId,
    input: UpdatePaymentInput
  ): Promise<Payment> {
    // The amount goes through its own RPC, which rewrites the allocation split
    // oldest-first inside one transaction. A plain UPDATE on the column would
    // leave the old allocations in place: lower the amount from 50 to 30 and the
    // invoices it was covering would still read as having received 50.
    if (input.amount !== undefined) {
      const { error } = await this.supabase.rpc('update_payment_amount', {
        p_organization_id: organizationId,
        p_payment_id: id,
        p_amount: input.amount,
      });

      if (error) throw new Error(`Failed to change the payment amount: ${error.message}`);
    }

    const patch: PaymentUpdate = {};
    if (input.payment_date !== undefined) patch.payment_date = toDateOnly(input.payment_date);
    if (input.payment_method !== undefined) patch.payment_method = input.payment_method;
    if (input.reference_number !== undefined) patch.reference_number = input.reference_number;
    if (input.notes !== undefined) patch.notes = input.notes;

    if (Object.keys(patch).length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error('Payment not found.');
      return existing;
    }

    const { data, error } = await this.supabase
      .from('payments')
      .update(patch)
      .eq('id', id)
      .is('deleted_at', null)
      .select(PAYMENT_COLUMNS)
      .single();

    if (error) throw new Error(`Failed to update payment: ${error.message}`);
    return mapPayment(data);
  }

  async delete(id: PaymentId): Promise<void> {
    // Soft delete. A payment that was taken and then reversed is a fact about the
    // shop's day; erasing the row would leave the customer's balance changing for
    // no visible reason.
    const { error } = await this.supabase
      .from('payments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to void payment: ${error.message}`);
  }
}

// ── Internals ─────────────────────────────────────────────────────────────────

/** payment_date is a DATE column — see the note in the sale repository. */
function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
