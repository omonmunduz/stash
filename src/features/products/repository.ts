/**
 * PRODUCT REPOSITORY
 *
 * Interface plus the Supabase implementation, in one file for the same reason
 * as the customer repository: there is exactly one implementation, and the
 * interface exists for testability and for a future move off Supabase.
 */

import type {
  Product,
  ProductWithInventory,
  CreateProductInput,
  UpdateProductInput,
  ProductFilter,
} from './types';
import type { ProductId, OrganizationId } from '@/lib/types/common';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';
import { mapProduct, mapProductWithInventory } from './mapper';
import {
  PRODUCT_COLUMNS,
  PRODUCT_LOOKUP_COLUMNS,
  applyProductSearch,
  productsBaseQuery,
} from './queries';
import { CATALOGUE_LIST_LIMIT } from '@/lib/constants/query-limits';

type ProductUpdate = Database['public']['Tables']['products']['Update'];

export interface ProductRepository {
  /** Find product by ID. Returns null if not found or soft-deleted. */
  findById(id: ProductId): Promise<Product | null>;

  /** Find product by SKU within an organization. */
  findBySku(sku: string, organizationId: OrganizationId): Promise<Product | null>;

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

/** Lightweight shape returned by search() for the sale form's product picker. */
export type ProductLookupResult = Pick<
  Product,
  'id' | 'sku' | 'name' | 'sale_price' | 'unit_of_measure'
>;

/**
 * Supabase-backed product repository.
 *
 * Error policy matches the customer repository: nothing found is null or an
 * empty array, anything else throws, and the service turns throws into Results.
 */
export class SupabaseProductRepository implements ProductRepository {
  constructor(private supabase: SupabaseServerClient) {}

  async findById(id: ProductId): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to load product: ${error.message}`);
    return data ? mapProduct(data) : null;
  }

  async findBySku(sku: string, organizationId: OrganizationId): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('organization_id', organizationId)
      .eq('sku', sku)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to load product by SKU: ${error.message}`);
    return data ? mapProduct(data) : null;
  }

  async findAll(filter: ProductFilter): Promise<Product[]> {
    let query = productsBaseQuery(this.supabase, filter.organization_id);

    if (filter.is_active !== undefined) {
      query = query.eq('is_active', filter.is_active);
    }
    if (filter.category) {
      query = query.eq('category', filter.category);
    }
    if (filter.search) {
      query = applyProductSearch(query, filter.search);
    }

    // Bound on the worst case, not pagination. See lib/constants/query-limits.
    // findAllWithInventory builds on this, so the cap also bounds the .in() list
    // of product ids in the inventory read below it.
    const { data, error } = await query
      .order('name', { ascending: true })
      .limit(CATALOGUE_LIST_LIMIT);

    if (error) throw new Error(`Failed to list products: ${error.message}`);
    return (data ?? []).map(mapProduct);
  }

  async findAllWithInventory(filter: ProductFilter): Promise<ProductWithInventory[]> {
    const products = await this.findAll(filter);
    if (products.length === 0) return [];

    // One batched inventory read rather than a join. A join through PostgREST
    // would nest the rows and force the mapper to know the embed shape; this
    // keeps the mapper taking a plain number and costs one extra round trip.
    const { data, error } = await this.supabase
      .from('inventory')
      .select('product_id, quantity_on_hand')
      .eq('organization_id', filter.organization_id)
      .in(
        'product_id',
        products.map((p) => p.id)
      );

    if (error) throw new Error(`Failed to load stock levels: ${error.message}`);

    const quantityByProduct = new Map<string, number>();
    for (const row of data ?? []) {
      // product_id is nullable since 20260803000001 — an inventory row counts
      // either a product or a non-sellable item. The .in() filter above already
      // restricts this to product rows, so a null here cannot happen; the guard is
      // what makes that legible to the type system rather than an assertion.
      if (row.product_id === null) continue;
      quantityByProduct.set(row.product_id, row.quantity_on_hand ?? 0);
    }

    // A product with no inventory row reads as 0 rather than being dropped from
    // the list — the trigger normally creates one, and a missing row is a data
    // problem the catalog should still show the product for.
    return products.map((product) => ({
      ...product,
      quantity_on_hand: quantityByProduct.get(product.id) ?? 0,
    }));
  }

  async create(organizationId: OrganizationId, input: CreateProductInput): Promise<Product> {
    const { data, error } = await this.supabase
      .from('products')
      .insert({
        organization_id: organizationId,
        sku: input.sku!,
        name: input.name,
        description: input.description ?? null,
        category: input.category ?? null,
        unit_of_measure: input.unit_of_measure ?? 'unit',
        cost_price: input.cost_price,
        sale_price: input.sale_price,
      })
      .select(PRODUCT_COLUMNS)
      .single();

    if (error) throw new Error(`Failed to create product: ${error.message}`);

    const product = mapProduct(data);

    // trg_create_inventory_for_product already made an inventory row at 0, so
    // opening stock is an update, not an insert. Written separately rather than
    // inside a transaction because a failure here leaves a valid product with
    // zero stock — recoverable by the stock screen, unlike a lost product.
    if (input.initial_quantity && input.initial_quantity > 0) {
      const { error: stockError } = await this.supabase
        .from('inventory')
        .update({ quantity_on_hand: input.initial_quantity })
        .eq('organization_id', organizationId)
        .eq('product_id', product.id);

      if (stockError) {
        throw new Error(
          `Product created, but opening stock could not be set: ${stockError.message}`
        );
      }
    }

    return product;
  }

  async update(id: ProductId, input: UpdateProductInput): Promise<Product> {
    // Same undefined-skipping patch as customers: spreading the whole input
    // would null out every field the edit form left alone.
    const patch: ProductUpdate = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        patch[key as keyof ProductUpdate] = value as never;
      }
    }

    if (Object.keys(patch).length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error('Product not found.');
      return existing;
    }

    const { data, error } = await this.supabase
      .from('products')
      .update(patch)
      .eq('id', id)
      .is('deleted_at', null)
      .select(PRODUCT_COLUMNS)
      .single();

    if (error) throw new Error(`Failed to update product: ${error.message}`);
    return mapProduct(data);
  }

  async delete(id: ProductId): Promise<void> {
    // Soft delete: sale_items reference products with ON DELETE RESTRICT, and
    // an old invoice must keep showing what was sold.
    const { error } = await this.supabase
      .from('products')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to delete product: ${error.message}`);
  }

  async search(
    organizationId: OrganizationId,
    query: string,
    limit: number = 10
  ): Promise<ProductLookupResult[]> {
    let builder = this.supabase
      .from('products')
      .select(PRODUCT_LOOKUP_COLUMNS)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .eq('is_active', true);

    if (query.trim()) {
      builder = applyProductSearch(builder, query);
    }

    const { data, error } = await builder.order('name', { ascending: true }).limit(limit);

    if (error) throw new Error(`Product search failed: ${error.message}`);

    return (data ?? []).map((row) => ({
      id: row.id as ProductLookupResult['id'],
      sku: row.sku,
      name: row.name,
      sale_price: row.sale_price ?? 0,
      unit_of_measure: row.unit_of_measure ?? 'unit',
    }));
  }

  async isSkuTaken(
    sku: string,
    organizationId: OrganizationId,
    excludeId?: ProductId
  ): Promise<boolean> {
    // Deliberately not filtering on deleted_at. UNIQUE(organization_id, sku)
    // covers soft-deleted rows too, so ignoring them here would report a SKU as
    // free and then fail on insert with a duplicate-key error.
    let builder = this.supabase
      .from('products')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('sku', sku);

    if (excludeId) {
      builder = builder.neq('id', excludeId);
    }

    const { data, error } = await builder.limit(1);

    if (error) throw new Error(`Failed to check SKU: ${error.message}`);
    return (data ?? []).length > 0;
  }
}
