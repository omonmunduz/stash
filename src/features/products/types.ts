/**
 * PRODUCT DOMAIN MODEL
 *
 * Products are the items the business buys from suppliers and sells to customers.
 * The key financial fields are cost_price and sale_price — the difference is the
 * gross profit per unit.
 *
 * Design decisions:
 * - Both cost_price and sale_price are required — profit tracking is a core feature
 * - category is free text — we do not know what industry the user is in
 * - unit_of_measure is free text — "box", "kg", "pallet", "unit" etc.
 * - sku is required and unique per org — the business's own product identifier
 *
 * No barcode field. An earlier draft declared one, but the products table has no
 * such column, so a mapper could only ever have written null into it — a field
 * that always reads null is worse than an absent one, because calling code
 * branches on it. It arrives in Phase 2 with the column, alongside scanning.
 *
 * reorder_level was in that same category until 20260803000001 added the column.
 * It is real now.
 */

import type {
  ProductId,
  OrganizationId,
  UserId,
  Timestamps,
  Auditable,
  Money,
  Quantity,
} from '@/lib/types/common';

export interface Product extends Timestamps, Auditable {
  id: ProductId;
  organization_id: OrganizationId;

  /**
   * Stock Keeping Unit — the business's own unique product code.
   * Examples: "FLOUR-50KG", "BOLT-M8-50MM", "TEA-BLACK-500G"
   * Unique per organization.
   */
  sku: string;

  name: string;
  description: string | null;

  /**
   * Free-text category. No predefined list — every industry uses
   * different category names.
   * Examples: "Flour", "Beverages", "Fasteners", "Electronics"
   */
  category: string | null;

  /**
   * Unit the product is sold in.
   * Examples: "unit", "box", "kg", "pallet", "dozen"
   */
  unit_of_measure: string;

  /** What the business pays to acquire this product */
  cost_price: Money;

  /** What customers are charged for this product */
  sale_price: Money;

  /**
   * Path to the object in the private product-images bucket, shaped
   * `<organization_id>/<product_id>.<ext>`. Not a URL: display goes through a
   * server-created signed URL, and storing an absolute one would mean storing
   * something that expires.
   */
  image_url: string | null;

  /**
   * Warn when stock falls to or below this. Null and 0 are different answers:
   * null means nobody has configured a warning for this product, 0 means "tell me
   * only when it has actually run out".
   */
  reorder_level: Quantity | null;

  is_active: boolean;
}

/** Input for creating a new product */
export interface CreateProductInput {
  sku?: string; // Auto-generated from name if omitted
  name: string;
  description?: string;
  category?: string;
  unit_of_measure?: string; // defaults to "unit"
  cost_price: Money;
  sale_price: Money;
  /**
   * Opening stock. A trigger creates the inventory row at 0 on insert; the
   * repository writes this over it when supplied.
   */
  initial_quantity?: Quantity;
}

/** Input for updating a product */
export interface UpdateProductInput {
  sku?: string;
  name?: string;
  description?: string | null;
  category?: string | null;
  unit_of_measure?: string;
  cost_price?: Money;
  sale_price?: Money;
  is_active?: boolean;
}

/** Filter parameters for querying products */
export interface ProductFilter {
  organization_id: OrganizationId;
  is_active?: boolean;
  category?: string;
  /** Substring search across name and sku */
  search?: string;
}

/** Product joined with its current inventory level */
export interface ProductWithInventory extends Product {
  quantity_on_hand: Quantity;
}
