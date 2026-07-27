/**
 * CUSTOMER QUERY BUILDERS
 *
 * Supabase-specific query construction for customers. This is the only
 * customer file that knows Supabase syntax — the repository composes these
 * and the service layer never sees them.
 *
 * Every builder filters by organization_id even though RLS already enforces
 * tenant isolation. Two reasons: RLS is the security boundary, not the query
 * planner's index hint, and an explicit filter means a misconfigured policy
 * degrades to "no rows" rather than "every tenant's rows".
 */

import type { SupabaseServerClient } from '@/lib/supabase/server';

/**
 * Full customer row. Listed explicitly rather than `*` so adding a column to
 * the table cannot silently change what the mapper receives.
 */
export const CUSTOMER_COLUMNS = 'id,organization_id,customer_code,name,business_name,email,phone,address,city,credit_limit,current_balance,notes,is_active,created_at,updated_at,deleted_at,created_by' as const;

/**
 * Reduced projection for quick-select dropdowns. Sales entry only needs enough
 * to identify the customer and warn about their credit position.
 */
export const CUSTOMER_LOOKUP_COLUMNS = 'id,customer_code,name,business_name,current_balance,credit_limit' as const;

/**
 * Base query: all non-deleted customers in one organization.
 */
export function customersBaseQuery(
  supabase: SupabaseServerClient,
  orgId: string
) {
  return supabase
    .from('customers')
    .select(CUSTOMER_COLUMNS)
    .eq('organization_id', orgId)
    .is('deleted_at', null);
}

/**
 * Escape a user-supplied search term for use inside a PostgREST `or()` filter.
 *
 * `or()` takes a comma-separated list where each condition is
 * `column.operator.value`, so an unescaped comma or parenthesis in the term
 * lets the user inject extra filter conditions. Backslash-escaping the
 * PostgREST metacharacters and stripping `%`/`_` (which would otherwise act as
 * wildcards in ILIKE) keeps the term as a literal substring match.
 */
export function escapeSearchTerm(term: string): string {
  return term
    .trim()
    .replace(/[\\,.()]/g, '\\$&')
    .replace(/[%_]/g, '');
}

/**
 * Apply a free-text search across the three fields staff actually search by.
 *
 * Not using Postgres full-text search: these are short identifier-like fields
 * where substring matching is what users expect ("072" should find a phone
 * number, which to_tsquery would not do).
 */
export function applyCustomerSearch<T extends { or: (filter: string) => T }>(
  query: T,
  search: string
): T {
  const term = escapeSearchTerm(search);
  if (!term) return query;

  return query.or(
    `name.ilike.%${term}%,business_name.ilike.%${term}%,phone.ilike.%${term}%`
  );
}

/**
 * Aggregates for the customer detail page, in one round trip per relation.
 *
 * Kept as separate queries rather than a single nested select because the
 * detail page renders them in independent sections, and a nested select would
 * make one slow relation block the whole page.
 */
export function customerOpenSalesQuery(
  supabase: SupabaseServerClient,
  orgId: string,
  customerId: string
) {
  return supabase
    .from('sales')
    .select('id, sale_number, sale_date, due_date, total, amount_paid, amount_due, payment_status, status')
    .eq('organization_id', orgId)
    .eq('customer_id', customerId)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .order('sale_date', { ascending: false });
}

export function customerPaymentsQuery(
  supabase: SupabaseServerClient,
  orgId: string,
  customerId: string
) {
  return supabase
    .from('payments')
    .select('id, payment_number, payment_date, amount, payment_method, reference_number, sale_id')
    .eq('organization_id', orgId)
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .order('payment_date', { ascending: false });
}
