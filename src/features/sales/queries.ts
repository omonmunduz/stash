/**
 * SALES QUERY BUILDERS
 *
 * Supabase query builders for sales operations.
 * Column selections are defined as constants for consistency.
 */

import type { SupabaseServerClient } from '@/lib/supabase/server';

// ── Column Selection ──────────────────────────────────────────────────────────

/** Lightweight sale for list views */
export const SALE_LIST_COLUMNS = `
  id, organization_id, sale_number, customer_id, sale_date, due_date,
  status, total, amount_paid, amount_due, payment_status, notes,
  created_by, created_at, updated_at,
  customer:customers ( id, customer_code, name, business_name, phone )
` as const;

/** Sale with line items — most common query */
export const SALE_WITH_ITEMS_COLUMNS = `
  id, organization_id, sale_number, customer_id, sale_date, due_date,
  status, subtotal, tax, discount, total, amount_paid, amount_due,
  payment_status, notes, created_by, created_at, updated_at,
  customer:customers ( id, customer_code, name, business_name, phone, credit_limit, current_balance ),
  items:sale_items (
    id, product_id, product_name, quantity, unit_price, cost_price, discount, subtotal, created_at
  )
` as const;

/** Full sale detail including payments — for invoice view */
export const SALE_WITH_DETAILS_COLUMNS = `
  id, organization_id, sale_number, customer_id, sale_date, due_date,
  status, subtotal, tax, discount, total, amount_paid, amount_due,
  payment_status, notes, created_by, created_at, updated_at,
  customer:customers ( id, customer_code, name, business_name, phone, address, city ),
  items:sale_items (
    id, product_id, product_name, quantity, unit_price, cost_price, discount, subtotal
  ),
  payments:payments (
    id, payment_number, amount, payment_method, payment_date, reference_number, notes
  )
` as const;

// ── Query Builders ────────────────────────────────────────────────────────────

export function salesBaseQuery(supabase: SupabaseServerClient, orgId: string) {
  return supabase
    .from('sales')
    .select(SALE_LIST_COLUMNS)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
}

export function saleWithItemsQuery(supabase: SupabaseServerClient, orgId: string, saleId: string) {
  return supabase
    .from('sales')
    .select(SALE_WITH_ITEMS_COLUMNS)
    .eq('organization_id', orgId)
    .eq('id', saleId)
    .is('deleted_at', null)
    .single();
}

export function saleWithDetailsQuery(supabase: SupabaseServerClient, orgId: string, saleId: string) {
  return supabase
    .from('sales')
    .select(SALE_WITH_DETAILS_COLUMNS)
    .eq('organization_id', orgId)
    .eq('id', saleId)
    .is('deleted_at', null)
    .single();
}

export function overduesSalesQuery(supabase: SupabaseServerClient, orgId: string) {
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
    .eq('status', 'completed')
    .is('deleted_at', null)
    .order('sale_date', { ascending: false });
}
