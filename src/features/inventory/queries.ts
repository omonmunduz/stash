/**
 * INVENTORY QUERY BUILDERS
 *
 * Supabase-specific query builders for inventory operations.
 * These are the only files that know about Supabase query syntax.
 * All other layers use the repository interface.
 */

import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

// Column selections
export const INVENTORY_WITH_PRODUCT_COLUMNS = `
  id,
  organization_id,
  product_id,
  quantity_on_hand,
  updated_at,
  product:products (
    id,
    sku,
    name,
    category,
    unit_of_measure,
    cost_price,
    sale_price,
    reorder_level,
    is_active
  )
` as const;

export const INVENTORY_SUMMARY_COLUMNS = `
  product_id,
  quantity_on_hand,
  updated_at,
  product:products ( name, sku, unit_of_measure, cost_price, reorder_level )
` as const;

/**
 * Base query for inventory within an organization.
 */
export function inventoryBaseQuery(
  supabase: SupabaseServerClient,
  orgId: string
) {
  return supabase
    .from('inventory')
    .select(INVENTORY_WITH_PRODUCT_COLUMNS)
    .eq('organization_id', orgId);
}

/**
 * Query for all low-stock products.
 * A product is "low stock" when quantity_on_hand <= reorder_level.
 *
 * Note: reorder_level comparison must happen in application code since
 * Supabase doesn't support cross-column comparisons in .lte() filters.
 * Use this query and filter in the service layer.
 */
export function lowStockQuery(supabase: SupabaseServerClient, orgId: string) {
  return supabase
    .from('inventory')
    .select(INVENTORY_WITH_PRODUCT_COLUMNS)
    .eq('organization_id', orgId)
    .gt('product.reorder_level', 0); // Only products with a threshold set
}

/**
 * Query for a single product's inventory.
 */
export function inventoryByProductQuery(
  supabase: SupabaseServerClient,
  orgId: string,
  productId: string
) {
  return supabase
    .from('inventory')
    .select(INVENTORY_WITH_PRODUCT_COLUMNS)
    .eq('organization_id', orgId)
    .eq('product_id', productId)
    .single();
}

/**
 * Query to verify a sale can be completed — checks all items have sufficient stock.
 * Returns the list of items with their current inventory levels.
 */
export function saleInventoryCheckQuery(
  supabase: SupabaseServerClient,
  orgId: string,
  saleId: string
) {
  return supabase
    .from('sale_items')
    .select(`
      product_id,
      product_name,
      quantity,
      inventory:inventory!inner (
        quantity_on_hand
      )
    `)
    .eq('sale_id', saleId)
    .eq('organization_id', orgId);
}
