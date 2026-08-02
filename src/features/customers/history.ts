/**
 * CUSTOMER HISTORY (server-only reads)
 *
 * The customer's tab: every transaction, what was on it, every payment, and which
 * invoices each payment cleared.
 *
 * Why this is not on CustomerService: the service is built from
 * CustomerRepository, and these are reads of the sales, sale_items, and payments
 * tables. Routing them through the customer repository would put sales queries
 * behind a customer interface; routing them through the sales and payments
 * repositories would mean assembling three services to render one page. This
 * module is the honest middle: a read-only projection owned by the page that
 * needs it.
 *
 * Read-only by design — nothing here mutates.
 */

import { createClient } from '@/lib/supabase/server';
import {
  customerSalesQuery,
  customerPaymentsQuery,
  saleItemsForSalesQuery,
  allocationsForPaymentsQuery,
} from './queries';
import type { CustomerId, OrganizationId } from '@/lib/types/common';
import type { Database } from '@/lib/database.types';

type SaleStatus = Database['public']['Enums']['sale_status'];
type PaymentStatus = Database['public']['Enums']['payment_status'];
type PaymentMethod = Database['public']['Enums']['payment_method'];

/** One product line on a transaction — what was taken, and for how much. */
export interface CustomerSaleItemRow {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

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
  /** Empty when the line-item read failed — see itemsUnavailable. */
  items: CustomerSaleItemRow[];
}

/** Where one payment landed. */
export interface CustomerPaymentAllocationRow {
  sale_id: string;
  /** Null while that sale is a draft. */
  sale_number: string | null;
  amount: number;
}

export interface CustomerPaymentRow {
  id: string;
  payment_number: string;
  payment_date: Date;
  amount: number;
  payment_method: PaymentMethod;
  reference_number: string | null;
  allocations: CustomerPaymentAllocationRow[];
  /** amount − sum(allocations): money held as credit rather than against an invoice. */
  unallocated_amount: number;
}

export interface CustomerHistory {
  sales: CustomerSaleRow[];
  payments: CustomerPaymentRow[];
  /**
   * True when a top-level query failed, so the page can say so instead of showing
   * an empty list. An empty list and a failed query look identical to a user, and
   * "you owe nothing" is a dangerous thing to show by accident.
   */
  partialFailure: boolean;
  /**
   * Separate from partialFailure: the transactions loaded but their contents did
   * not. The balances on screen are still correct, so the page should show them
   * and just admit the breakdown is missing.
   */
  itemsUnavailable: boolean;
}

/**
 * Load a customer's transactions with line items, and their payments with the
 * invoices those payments cleared.
 *
 * Two rounds of queries, not four sequential ones. The sales and payments reads
 * are independent so they run together; the item and allocation reads need the
 * IDs from the first round, so they run together in a second. That is two waits
 * instead of four, without an N+1 per row.
 */
export async function getCustomerHistory(
  organizationId: OrganizationId,
  customerId: CustomerId
): Promise<CustomerHistory> {
  const supabase = await createClient();

  const [salesResult, paymentsResult] = await Promise.all([
    customerSalesQuery(supabase, organizationId, customerId),
    customerPaymentsQuery(supabase, organizationId, customerId),
  ]);

  const saleRows = salesResult.data ?? [];
  const paymentRows = paymentsResult.data ?? [];

  const saleIds = saleRows.map((row) => row.id);
  const paymentIds = paymentRows.map((row) => row.id);

  // `.in()` with an empty array is a valid query that matches nothing, but it is
  // still a round trip. Skipping it matters on the common case of a new customer
  // with no history at all.
  const [itemsResult, allocationsResult] = await Promise.all([
    saleIds.length > 0
      ? saleItemsForSalesQuery(supabase, organizationId, saleIds)
      : Promise.resolve({ data: [], error: null } as const),
    paymentIds.length > 0
      ? allocationsForPaymentsQuery(supabase, organizationId, paymentIds)
      : Promise.resolve({ data: [], error: null } as const),
  ]);

  const itemsBySale = new Map<string, CustomerSaleItemRow[]>();
  for (const row of itemsResult.data ?? []) {
    const entry = itemsBySale.get(row.sale_id) ?? [];
    entry.push({
      id: row.id,
      product_id: row.product_id,
      product_name: row.product_name,
      product_sku: row.product_sku,
      quantity: row.quantity,
      unit_price: row.unit_price,
      subtotal: row.subtotal,
    });
    itemsBySale.set(row.sale_id, entry);
  }

  const allocationsByPayment = new Map<string, CustomerPaymentAllocationRow[]>();
  for (const row of allocationsResult.data ?? []) {
    const entry = allocationsByPayment.get(row.payment_id) ?? [];
    entry.push({
      sale_id: row.sale_id,
      sale_number: row.sale?.sale_number ?? null,
      amount: row.amount,
    });
    allocationsByPayment.set(row.payment_id, entry);
  }

  const sales: CustomerSaleRow[] = saleRows.map((row) => ({
    id: row.id,
    sale_number: row.sale_number,
    sale_date: new Date(row.sale_date),
    due_date: row.due_date ? new Date(row.due_date) : null,
    total: row.total ?? 0,
    amount_paid: row.amount_paid ?? 0,
    amount_due: row.amount_due ?? 0,
    payment_status: row.payment_status ?? 'unpaid',
    status: row.status ?? 'draft',
    items: itemsBySale.get(row.id) ?? [],
  }));

  const payments: CustomerPaymentRow[] = paymentRows.map((row) => {
    const allocations = allocationsByPayment.get(row.id) ?? [];
    const applied = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);

    return {
      id: row.id,
      payment_number: row.payment_number,
      payment_date: new Date(row.payment_date),
      amount: row.amount,
      payment_method: row.payment_method,
      reference_number: row.reference_number,
      allocations,
      unallocated_amount: Math.max(0, row.amount - applied),
    };
  });

  return {
    sales,
    payments,
    partialFailure: Boolean(salesResult.error || paymentsResult.error),
    itemsUnavailable: Boolean(itemsResult.error || allocationsResult.error),
  };
}
