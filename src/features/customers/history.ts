/**
 * CUSTOMER HISTORY (server-only reads)
 *
 * Sales and payments for one customer, for the detail page.
 *
 * Why this is not on CustomerService: the service is built from
 * CustomerRepository, and these are reads of the sales and payments tables.
 * Routing them through the customer repository would put sales queries behind a
 * customer interface; routing them through the sales and payments repositories
 * would mean implementing both features to render one page. This module is the
 * honest middle: a read-only projection, owned by the page that needs it, that
 * the sales and payments features can replace once they exist.
 *
 * Read-only by design — nothing here mutates.
 */

import { createClient } from '@/lib/supabase/server';
import { customerOpenSalesQuery, customerPaymentsQuery } from './queries';
import type { CustomerId, OrganizationId } from '@/lib/types/common';
import type { Database } from '@/lib/database.types';

type SaleStatus = Database['public']['Enums']['sale_status'];
type PaymentStatus = Database['public']['Enums']['payment_status'];
type PaymentMethod = Database['public']['Enums']['payment_method'];

export interface CustomerSaleRow {
  id: string;
  sale_number: string | null;
  sale_date: Date;
  due_date: Date | null;
  total: number;
  amount_paid: number;
  amount_due: number;
  payment_status: PaymentStatus;
  status: SaleStatus;
}

export interface CustomerPaymentRow {
  id: string;
  payment_number: string;
  payment_date: Date;
  amount: number;
  payment_method: PaymentMethod;
  reference_number: string | null;
  sale_id: string | null;
}

export interface CustomerHistory {
  sales: CustomerSaleRow[];
  payments: CustomerPaymentRow[];
  /** True when either query failed, so the page can say so instead of showing an empty list. */
  partialFailure: boolean;
}

/**
 * Load a customer's completed sales and all recorded payments.
 *
 * Both queries run concurrently — they are independent, and the detail page
 * cannot render until it has both.
 *
 * A failure in one does not blank the page: the other section still renders and
 * partialFailure tells the page to warn. An empty list and a failed query look
 * identical to a user otherwise, and "you have no debts" is a dangerous thing to
 * show by accident.
 */
export async function getCustomerHistory(
  organizationId: OrganizationId,
  customerId: CustomerId
): Promise<CustomerHistory> {
  const supabase = await createClient();

  const [salesResult, paymentsResult] = await Promise.all([
    customerOpenSalesQuery(supabase, organizationId, customerId),
    customerPaymentsQuery(supabase, organizationId, customerId),
  ]);

  const sales: CustomerSaleRow[] = (salesResult.data ?? []).map((row) => ({
    id: row.id,
    sale_number: row.sale_number,
    sale_date: new Date(row.sale_date),
    due_date: row.due_date ? new Date(row.due_date) : null,
    total: row.total ?? 0,
    amount_paid: row.amount_paid ?? 0,
    amount_due: row.amount_due ?? 0,
    payment_status: row.payment_status ?? 'unpaid',
    status: row.status ?? 'draft',
  }));

  const payments: CustomerPaymentRow[] = (paymentsResult.data ?? []).map((row) => ({
    id: row.id,
    payment_number: row.payment_number,
    payment_date: new Date(row.payment_date),
    amount: row.amount,
    payment_method: row.payment_method,
    reference_number: row.reference_number,
    sale_id: row.sale_id,
  }));

  return {
    sales,
    payments,
    partialFailure: Boolean(salesResult.error || paymentsResult.error),
  };
}
