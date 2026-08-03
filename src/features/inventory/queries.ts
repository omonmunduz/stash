/**
 * INVENTORY QUERY BUILDERS
 *
 * The only inventory file that knows Supabase syntax. Same conventions as
 * products/queries.ts: explicit column lists so a new column cannot silently
 * reach the mapper, and an explicit organization_id filter alongside RLS so a
 * broken policy fails closed.
 *
 * A stock row embeds either a product or an item, never both. Both embeds are
 * requested on every read and one always comes back null — cheaper than two
 * queries, and the mapper turns the pair into a discriminated union immediately so
 * nothing above this layer handles the nullable shape.
 *
 * Low stock is filtered in application code rather than SQL. PostgREST cannot
 * compare two columns to each other (quantity_on_hand <= reorder_level), and the
 * comparison lives on the embedded side besides. The previous version of this file
 * tried `.gt('product.reorder_level', 0)`, which filtered on a column that did not
 * exist and would have failed on every call.
 */

import type { SupabaseServerClient } from '@/lib/supabase/server';
import { escapeSearchTerm } from '@/features/customers/queries';

/** A stock row plus whichever thing it counts. */
export const INVENTORY_COLUMNS = `
  id,
  organization_id,
  product_id,
  item_id,
  quantity_on_hand,
  updated_at,
  product:products (
    id, sku, name, category, unit_of_measure,
    cost_price, sale_price, image_url, reorder_level, is_active
  ),
  item:inventory_items (
    id, item_code, name, category, unit_of_measure,
    cost_price, image_url, reorder_level, is_active
  )
` as const;

/** Full item row, for the item catalogue. */
export const INVENTORY_ITEM_COLUMNS =
  'id,organization_id,item_code,name,description,category,unit_of_measure,cost_price,image_url,reorder_level,is_active,created_at,updated_at,deleted_at,created_by' as const;

/** One logged adjustment, with the name of what it moved. */
export const INVENTORY_ADJUSTMENT_COLUMNS = `
  id,
  organization_id,
  product_id,
  item_id,
  quantity_delta,
  quantity_after,
  reason,
  notes,
  adjusted_by,
  adjusted_at,
  product:products ( id, sku, name ),
  item:inventory_items ( id, item_code, name )
` as const;

export function inventoryBaseQuery(supabase: SupabaseServerClient, orgId: string) {
  return supabase
    .from('inventory')
    .select(INVENTORY_COLUMNS)
    .eq('organization_id', orgId);
}

export function inventoryItemsBaseQuery(supabase: SupabaseServerClient, orgId: string) {
  return supabase
    .from('inventory_items')
    .select(INVENTORY_ITEM_COLUMNS)
    .eq('organization_id', orgId)
    .is('deleted_at', null);
}

export function adjustmentsBaseQuery(supabase: SupabaseServerClient, orgId: string) {
  return supabase
    .from('inventory_adjustments')
    .select(INVENTORY_ADJUSTMENT_COLUMNS)
    .eq('organization_id', orgId);
}

/**
 * Substring search over an item's name and code.
 *
 * Reuses the customer escaper for the same reason products does: the injection
 * surface is the same PostgREST `or()` grammar, and two copies of an escaping rule
 * is how one of them ends up missing a metacharacter.
 */
export function applyItemSearch<T extends { or: (filter: string) => T }>(
  query: T,
  search: string
): T {
  const term = escapeSearchTerm(search);
  if (!term) return query;
  return query.or(`name.ilike.%${term}%,item_code.ilike.%${term}%`);
}
