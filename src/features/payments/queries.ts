/**
 * PAYMENT QUERY BUILDERS
 *
 * Column selections and shared builders for payment reads.
 */

import type { SupabaseServerClient } from '@/lib/supabase/server';

/** Payment ledger row. No sale_id — see PaymentAllocation. */
export const PAYMENT_COLUMNS = `
  id, organization_id, payment_number, customer_id, payment_date, amount,
  payment_method, reference_number, notes, created_by, created_at, updated_at,
  updated_by, deleted_at
` as const;

/** Allocation row plus the invoice number of the sale it landed on. */
export const ALLOCATION_COLUMNS = `
  id, organization_id, payment_id, sale_id, amount, created_at,
  sale:sales ( id, sale_number )
` as const;

export function paymentsBaseQuery(supabase: SupabaseServerClient, orgId: string) {
  return supabase
    .from('payments')
    .select(PAYMENT_COLUMNS)
    .eq('organization_id', orgId)
    .is('deleted_at', null);
}

/**
 * Every payment a customer has made, newest first.
 *
 * payment_date is the business fact — when the money changed hands — so it leads
 * the sort. created_at breaks ties, because several payments entered on the same
 * day should still read in the order they were taken.
 */
export function paymentsByCustomerQuery(
  supabase: SupabaseServerClient,
  orgId: string,
  customerId: string
) {
  return paymentsBaseQuery(supabase, orgId)
    .eq('customer_id', customerId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });
}

/** Allocations for a set of payments, for grouping in memory. */
export function allocationsForPaymentsQuery(
  supabase: SupabaseServerClient,
  orgId: string,
  paymentIds: string[]
) {
  return supabase
    .from('payment_allocations')
    .select(ALLOCATION_COLUMNS)
    .eq('organization_id', orgId)
    .in('payment_id', paymentIds)
    .order('created_at', { ascending: true });
}
