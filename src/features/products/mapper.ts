/**
 * PRODUCT MAPPER
 *
 * Supabase row -> domain Product. Same reasons as the customer mapper: dates
 * arrive as ISO strings, money columns are typed nullable for DB flexibility
 * but the domain treats them as plain numbers, and branded IDs exist only above
 * this line.
 */

import type { Database } from '@/lib/database.types';
import type { Product, ProductWithInventory } from './types';
import { brandId } from '@/lib/types/common';

type ProductRow = Database['public']['Tables']['products']['Row'];

export function mapProduct(row: ProductRow): Product {
  return {
    id: brandId(row.id),
    organization_id: brandId(row.organization_id),
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category,
    // Schema default is 'unit'; the fallback covers a row written before that
    // default existed rather than rendering an empty unit in the UI.
    unit_of_measure: row.unit_of_measure ?? 'unit',
    cost_price: row.cost_price ?? 0,
    sale_price: row.sale_price ?? 0,
    is_active: row.is_active ?? true,
    created_at: new Date(row.created_at!),
    updated_at: new Date(row.updated_at!),
    deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
    created_by: row.created_by ? brandId(row.created_by) : null,
  };
}

/**
 * Product plus its stock level.
 *
 * quantityOnHand is passed in rather than read off a join: the repository
 * fetches inventory in one batched query for the whole page, so the mapper
 * never sees the join shape.
 */
export function mapProductWithInventory(
  row: ProductRow,
  quantityOnHand: number
): ProductWithInventory {
  return {
    ...mapProduct(row),
    quantity_on_hand: quantityOnHand,
  };
}
