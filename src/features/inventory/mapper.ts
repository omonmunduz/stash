/**
 * INVENTORY MAPPER
 *
 * Supabase row -> domain object. Same reasons as the product mapper: dates arrive
 * as ISO strings, money and quantity columns are typed nullable for database
 * flexibility but the domain treats them as plain numbers, and branded IDs exist
 * only above this line.
 *
 * The job specific to this feature is collapsing the nullable
 * (product_id, item_id) pair into an InventorySubject union. The database
 * guarantees exactly one is set — inventory_exactly_one_subject — but that
 * guarantee is invisible to TypeScript, so it is asserted once here rather than
 * re-checked at every call site.
 */

import type { Database } from '@/lib/database.types';
import type {
  Inventory,
  InventoryLine,
  InventoryItem,
  InventoryAdjustment,
  InventoryAdjustmentReason,
  InventorySubject,
} from './types';
import { brandId } from '@/lib/types/common';

type InventoryItemRow = Database['public']['Tables']['inventory_items']['Row'];

/** The embedded shapes INVENTORY_COLUMNS requests. */
interface EmbeddedProduct {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit_of_measure: string | null;
  cost_price: number;
  sale_price: number;
  image_url: string | null;
  reorder_level: number | null;
  is_active: boolean | null;
}

interface EmbeddedItem {
  id: string;
  item_code: string;
  name: string;
  category: string | null;
  unit_of_measure: string | null;
  cost_price: number;
  image_url: string | null;
  reorder_level: number | null;
  is_active: boolean | null;
}

export interface InventoryRow {
  id: string;
  organization_id: string;
  product_id: string | null;
  item_id: string | null;
  quantity_on_hand: number | null;
  updated_at: string | null;
  product: EmbeddedProduct | null;
  item: EmbeddedItem | null;
}

/**
 * A stock row whose embed came back null.
 *
 * Only reachable if the counted product or item was hard-deleted while its stock
 * row survived, which the ON DELETE CASCADE on both foreign keys prevents. Thrown
 * rather than defaulted: a stock line for an unidentifiable thing is a data
 * problem to fix, not something to render as "Unknown".
 */
class OrphanedStockRow extends Error {
  constructor(id: string) {
    super(
      `Stock row ${id} counts neither a product nor an item. This should be ` +
        `impossible — inventory_exactly_one_subject enforces exactly one.`
    );
  }
}

function toSubject(row: InventoryRow): InventorySubject {
  if (row.product_id !== null && row.product !== null) {
    return {
      kind: 'product',
      product_id: brandId(row.product_id),
      name: row.product.name,
      code: row.product.sku,
    };
  }

  if (row.item_id !== null && row.item !== null) {
    return {
      kind: 'item',
      item_id: brandId(row.item_id),
      name: row.item.name,
      code: row.item.item_code,
    };
  }

  throw new OrphanedStockRow(row.id);
}

export function mapInventory(row: InventoryRow): Inventory {
  return {
    id: brandId(row.id),
    organization_id: brandId(row.organization_id),
    quantity_on_hand: row.quantity_on_hand ?? 0,
    updated_at: new Date(row.updated_at!),
    subject: toSubject(row),
  };
}

/**
 * A stock row with the fields the inventory list renders, lifted out of whichever
 * side the embed came back on.
 *
 * is_low_stock is computed here rather than in the query because PostgREST cannot
 * compare two columns to one another, let alone across an embed.
 */
export function mapInventoryLine(row: InventoryRow): InventoryLine {
  const base = mapInventory(row);
  const source = row.product ?? row.item;

  if (!source) throw new OrphanedStockRow(row.id);

  const costPrice = source.cost_price ?? 0;
  const reorderLevel = source.reorder_level;

  return {
    ...base,
    cost_price: costPrice,
    reorder_level: reorderLevel,
    unit_of_measure: source.unit_of_measure ?? 'unit',
    image_url: source.image_url,
    is_active: source.is_active ?? true,
    stock_value: base.quantity_on_hand * costPrice,
    // Null reorder_level means no warning was configured, which is why this is not
    // `(reorderLevel ?? 0)` — that would turn every unconfigured product into a
    // low-stock alert the moment it hit zero, burying the ones set deliberately.
    is_low_stock: reorderLevel !== null && base.quantity_on_hand <= reorderLevel,
    sale_price: row.product ? row.product.sale_price ?? 0 : null,
  };
}

export function mapInventoryItem(row: InventoryItemRow): InventoryItem {
  return {
    id: brandId(row.id),
    organization_id: brandId(row.organization_id),
    item_code: row.item_code,
    name: row.name,
    description: row.description,
    category: row.category,
    // Schema default is 'unit'; the fallback covers a row written before that
    // default existed rather than rendering an empty unit in the UI.
    unit_of_measure: row.unit_of_measure ?? 'unit',
    cost_price: row.cost_price ?? 0,
    image_url: row.image_url,
    reorder_level: row.reorder_level,
    is_active: row.is_active ?? true,
    created_at: new Date(row.created_at!),
    updated_at: new Date(row.updated_at!),
    deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
    created_by: row.created_by ? brandId(row.created_by) : null,
  };
}

interface AdjustmentRow {
  id: string;
  organization_id: string;
  product_id: string | null;
  item_id: string | null;
  quantity_delta: number;
  quantity_after: number;
  reason: string;
  notes: string | null;
  adjusted_by: string | null;
  adjusted_at: string;
  product: { id: string; sku: string; name: string } | null;
  item: { id: string; item_code: string; name: string } | null;
}

export function mapInventoryAdjustment(row: AdjustmentRow): InventoryAdjustment {
  const subject: InventorySubject =
    row.product_id !== null && row.product !== null
      ? {
          kind: 'product',
          product_id: brandId(row.product_id),
          name: row.product.name,
          code: row.product.sku,
        }
      : row.item_id !== null && row.item !== null
        ? {
            kind: 'item',
            item_id: brandId(row.item_id),
            name: row.item.name,
            code: row.item.item_code,
          }
        : (() => {
            throw new OrphanedStockRow(row.id);
          })();

  return {
    id: brandId(row.id),
    organization_id: brandId(row.organization_id),
    subject,
    quantity_delta: row.quantity_delta,
    quantity_after: row.quantity_after,
    // Widened from TEXT rather than validated: the column's CHECK constraint is
    // the authority on which values exist, and a row that got past it is by
    // definition one of them.
    reason: row.reason as InventoryAdjustmentReason,
    notes: row.notes,
    adjusted_by: row.adjusted_by ? brandId(row.adjusted_by) : null,
    adjusted_at: new Date(row.adjusted_at),
  };
}
