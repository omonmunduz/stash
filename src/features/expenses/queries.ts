/**
 * EXPENSE QUERY BUILDERS
 *
 * Column selections and shared builders for expense reads.
 */

import type { SupabaseServerClient } from '@/lib/supabase/server';
import { escapeSearchTerm } from '@/features/customers/queries';

export const EXPENSE_COLUMNS = `
  id, organization_id, expense_number, expense_date, category, vendor, amount,
  payment_method, description, receipt_url, created_by, created_at, updated_at,
  deleted_at
` as const;

export function expensesBaseQuery(supabase: SupabaseServerClient, orgId: string) {
  return supabase
    .from('expenses')
    .select(EXPENSE_COLUMNS)
    .eq('organization_id', orgId)
    .is('deleted_at', null);
}

/**
 * Expenses newest first.
 *
 * expense_date leads the sort because it is the business fact — when the money
 * actually went out. created_at breaks ties so several expenses entered for the
 * same day still read in the order they were logged.
 */
export function expensesListQuery(supabase: SupabaseServerClient, orgId: string) {
  return expensesBaseQuery(supabase, orgId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });
}

/**
 * Free-text search across the three fields an expense is looked up by.
 *
 * Description leads because it is the only required free-text field — "what was
 * this for" is the question being asked. Vendor and category are included
 * because "everything I bought from Musa" and "all the transport" are the same
 * kind of question, and a shopkeeper should not have to know which box the
 * answer was typed into.
 *
 * escapeSearchTerm is reused from the customer queries: it is the same PostgREST
 * `or()` injection problem, and duplicating the escaping would mean two places
 * to fix it.
 */
export function applyExpenseSearch<T extends { or: (filter: string) => T }>(
  query: T,
  search: string
): T {
  const term = escapeSearchTerm(search);
  if (!term) return query;

  return query.or(
    `description.ilike.%${term}%,vendor.ilike.%${term}%,category.ilike.%${term}%`
  );
}
