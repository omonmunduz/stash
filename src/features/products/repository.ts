/**
 * PRODUCT REPOSITORY INTERFACE
 */

import type {
  Product,
  ProductWithInventory,
  CreateProductInput,
  UpdateProductInput,
  ProductFilter,
} from './types';
import type { ProductId, OrganizationId } from '@/lib/types/common';

export interface ProductRepository {
  /** Find product by ID. Returns null if not found or soft-deleted. */
  findById(id: ProductId): Promise<Product | null>;

  /** Find product by SKU within an organization. */
  findBySku(sku: string, organizationId: OrganizationId): Promise<Product | null>;

  /** Find product by barcode (Phase 2). */
  findByBarcode(barcode: string, organizationId: OrganizationId): Promise<Product | null>;

  /** List all products with optional filtering and pagination. */
  findAll(filter: ProductFilter): Promise<Product[]>;

  /**
   * List products joined with their current inventory quantity.
   * Used for the products page to show stock levels.
   */
  findAllWithInventory(filter: ProductFilter): Promise<ProductWithInventory[]>;

  /**
   * Create a product and its initial inventory record.
   * Wrapped in a transaction: both succeed or both fail.
   */
  create(organizationId: OrganizationId, input: CreateProductInput): Promise<Product>;

  /** Update product fields. */
  update(id: ProductId, input: UpdateProductInput): Promise<Product>;

  /** Soft-delete a product. */
  delete(id: ProductId): Promise<void>;

  /**
   * Search products by name or SKU for quick-select dropdowns in sales forms.
   * Returns lightweight results.
   */
  search(
    organizationId: OrganizationId,
    query: string,
    limit?: number
  ): Promise<Pick<Product, 'id' | 'sku' | 'name' | 'sale_price' | 'unit_of_measure'>[]>;

  /**
   * Check whether a SKU is already in use within an organization.
   * Used before creating or updating a product.
   */
  isSkuTaken(sku: string, organizationId: OrganizationId, excludeId?: ProductId): Promise<boolean>;
}
