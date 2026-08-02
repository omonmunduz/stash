/**
 * SALES QUERY BUILDERS
 *
 * Supabase query builders for sales operations.
 * Column selections are defined as constants for consistency.
 *
 * Note on the payments embed: payments no longer carry a sale_id, so a sale
 * reaches its payments through payment_allocations. The embed is therefore
 * nested one level deeper than it looks — allocations, then the payment behind
 * each one. This is the whole point of the allocation table: one payment can
 * appear on several invoices, which a direct FK could not express.
 */

import type { SupabaseServerClient } from '@/lib/supabase/server';

// ── Column Selection ──────────────────────────────────────────────────────────

/** Sale header only — no embeds. Used where the caller already has the customer. */
export const SALE_COLUMNS = `
  id, organization_id, sale_number, customer_id, sale_date, due_date,
  status, subtotal, tax, discount, total, amount_paid, amount_due,
  payment_status, notes, created_by, created_at, updated_at, deleted_at
` as const;

/** Line items belonging to a sale. */
export const SALE_ITEM_COLUMNS = `
  id, organization_id, sale_id, product_id, product_name, product_sku,
  quantity, unit_price, cost_price, discount, subtotal, created_at
` as const;

/** Lightweight sale for list views, with enough customer detail to render a row. */
export const SALE_LIST_COLUMNS = `
  ${SALE_COLUMNS},
  customer:customers ( id, customer_code, name, business_name, phone )
` as const;

/** Sale with line items — most common detail query. */
export const SALE_WITH_ITEMS_COLUMNS = `
  ${SALE_COLUMNS},
  customer:customers ( id, customer_code, name, business_name, phone, credit_limit, current_balance ),
  items:sale_items ( ${SALE_ITEM_COLUMNS} )
` as const;

/**
 * Full sale detail including the payments applied to it — for the invoice view.
 *
 * `amount` on the allocation is what this payment put toward THIS sale, which is
 * not necessarily the payment's full amount. Showing payments.amount here would
 * overstate what the invoice received whenever a payment was split.
 */
export const SALE_WITH_DETAILS_COLUMNS = `
  ${SALE_COLUMNS},
  customer:customers ( id, customer_code, name, business_name, phone, address, city ),
  items:sale_items ( ${SALE_ITEM_COLUMNS} ),
  allocations:payment_allocations (
    id, amount,
    payment:payments (
      id, payment_number, amount, payment_method, payment_date,
      reference_number, notes, deleted_at
    )
  )
` as const;

// ── Query Builders ────────────────────────────────────────────────────────────

export function salesBaseQuery(supabase: SupabaseServerClient, orgId: string) {
  return supabase
    .from('sales')
    .select(SALE_LIST_COLUMNS)
    .eq('organization_id', orgId)
    .is('deleted_at', null);
}

export function saleWithItemsQuery(supabase: SupabaseServerClient, orgId: string, saleId: string) {
  return supabase
    .from('sales')
    .select(SALE_WITH_ITEMS_COLUMNS)
    .eq('organization_id', orgId)
    .eq('id', saleId)
    .is('deleted_at', null)
    .maybeSingle();
}

export function saleWithDetailsQuery(supabase: SupabaseServerClient, orgId: string, saleId: string) {
  return supabase
    .from('sales')
    .select(SALE_WITH_DETAILS_COLUMNS)
    .eq('organization_id', orgId)
    .eq('id', saleId)
    .is('deleted_at', null)
    .maybeSingle();
}

export function overdueSalesQuery(supabase: SupabaseServerClient, orgId: string) {
  const today = new Date().toISOString().split('T')[0];
  return supabase
    .from('sales')
    .select(SALE_LIST_COLUMNS)
    .eq('organization_id', orgId)
    .eq('status', 'completed')
    .in('payment_status', ['unpaid', 'partial'])
    .lt('due_date', today)
    .is('deleted_at', null)
    .order('due_date', { ascending: true });
}

/**
 * Every sale for one customer, newest first — the customer tab view.
 *
 * Deliberately not filtered to 'completed'. A draft sale is goods being picked
 * out right now; hiding it from the customer's own page is how someone walks
 * out with a basket nobody recorded. Cancelled sales are excluded because they
 * represent nothing owed and nothing taken.
 */
export function salesByCustomerQuery(
  supabase: SupabaseServerClient,
  orgId: string,
  customerId: string
) {
  return supabase
    .from('sales')
    .select(SALE_LIST_COLUMNS)
    .eq('organization_id', orgId)
    .eq('customer_id', customerId)
    .in('status', ['draft', 'completed'])
    .is('deleted_at', null)
    .order('sale_date', { ascending: false })
    .order('created_at', { ascending: false });
}
