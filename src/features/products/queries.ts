/**
 * PRODUCT QUERY BUILDERS
 *
 * The only product file that knows Supabase syntax. Same conventions as
 * customers/queries.ts: explicit column lists so a new column cannot silently
 * reach the mapper, and an explicit organization_id filter alongside RLS so a
 * broken policy fails closed.
 */

import type { SupabaseServerClient } from '@/lib/supabase/server';
import { escapeSearchTerm } from '@/features/customers/queries';

/** Full product row, matching the columns the MVP schema actually has. */
export const PRODUCT_COLUMNS =
  'id,organization_id,sku,name,description,category,unit_of_measure,cost_price,sale_price,image_url,reorder_level,is_active,created_at,updated_at,deleted_at,created_by' as const;

/**
 * Reduced projection for the line-item picker on the sale form.
 *
 * Deliberately without image_url: the picker is a text select, and a signed URL
 * per option would be one Storage round trip per product for something never
 * rendered.
 */
export const PRODUCT_LOOKUP_COLUMNS = 'id,sku,name,sale_price,unit_of_measure' as const;

export function productsBaseQuery(supabase: SupabaseServerClient, orgId: string) {
  return supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('organization_id', orgId)
    .is('deleted_at', null);
}

/**
 * Substring search over name and sku.
 *
 * Reuses the customer escaper rather than defining a second one: the injection
 * surface is the same PostgREST `or()` grammar, and two copies of an escaping
 * rule is how one of them ends up missing a metacharacter.
 */
export function applyProductSearch<T extends { or: (filter: string) => T }>(
  query: T,
  search: string
): T {
  const term = escapeSearchTerm(search);
  if (!term) return query;

  return query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
}
