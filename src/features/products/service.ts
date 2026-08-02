/**
 * PRODUCT SERVICE
 *
 * Orchestrates catalog operations. Server Actions call this; they never touch
 * the repository directly.
 *
 * Responsibilities that live here rather than in the repository:
 * - Input validation (Zod schemas)
 * - SKU derivation and the uniqueness check
 * - Turning thrown repository errors into Result values
 *
 * Org-scoped through the constructor, so no call site can forget to pass one.
 */

import type { ProductRepository, ProductLookupResult } from './repository';
import type { Product, ProductWithInventory, ProductFilter } from './types';
import type { ProductId, OrganizationId, Result } from '@/lib/types/common';
import { createProductSchema, updateProductSchema } from './schemas';
import { generateSkuFromName } from './business-rules';

/** Shape the list page filters by. */
export interface ProductListOptions {
  search?: string;
  /** 'all' includes inactive products; defaults to active only. */
  status?: 'active' | 'inactive' | 'all';
  category?: string;
}

export class ProductService {
  constructor(
    private repo: ProductRepository,
    private orgId: OrganizationId
  ) {}

  /** Catalog list with stock levels — what the products page renders. */
  async list(options: ProductListOptions = {}): Promise<Result<ProductWithInventory[]>> {
    const filter: ProductFilter = {
      organization_id: this.orgId,
      search: options.search,
      category: options.category,
    };

    // 'all' means "do not filter", so is_active stays undefined.
    if (options.status === 'active' || options.status === undefined) {
      filter.is_active = true;
    } else if (options.status === 'inactive') {
      filter.is_active = false;
    }

    try {
      return { success: true, data: await this.repo.findAllWithInventory(filter) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load products.') };
    }
  }

  /**
   * Load one product.
   *
   * Checks tenancy explicitly rather than trusting RLS alone: a cross-tenant ID
   * should read as "not found", not as a policy error.
   */
  async getById(id: ProductId): Promise<Result<Product>> {
    try {
      const product = await this.repo.findById(id);

      if (!product || product.organization_id !== this.orgId) {
        return { success: false, error: 'Product not found.' };
      }

      return { success: true, data: product };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load product.') };
    }
  }

  /**
   * Create a product.
   *
   * SKU is derived from the name when the form leaves it blank, then checked for
   * collisions. Checking here rather than catching the duplicate-key error means
   * the user gets "that SKU is taken" instead of a constraint name — and a
   * derived SKU that collides can be reported against the field they can fix.
   */
  async create(input: unknown): Promise<Result<Product>> {
    const parsed = createProductSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }

    const sku = parsed.data.sku?.trim() || generateSkuFromName(parsed.data.name);

    if (!sku) {
      return { success: false, error: 'Could not derive a SKU from that name. Enter one manually.' };
    }

    try {
      if (await this.repo.isSkuTaken(sku, this.orgId)) {
        return {
          success: false,
          error: `SKU "${sku}" is already in use. Enter a different one.`,
        };
      }

      return {
        success: true,
        data: await this.repo.create(this.orgId, { ...parsed.data, sku }),
      };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not create product.') };
    }
  }

  /** Update a product. Confirms tenancy before writing. */
  async update(id: ProductId, input: unknown): Promise<Result<Product>> {
    const parsed = updateProductSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }

    const existing = await this.getById(id);
    if (!existing.success) return existing;

    try {
      if (parsed.data.sku && (await this.repo.isSkuTaken(parsed.data.sku, this.orgId, id))) {
        return {
          success: false,
          error: `SKU "${parsed.data.sku}" is already in use by another product.`,
        };
      }

      return { success: true, data: await this.repo.update(id, parsed.data) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not update product.') };
    }
  }

  /**
   * Soft-delete a product.
   *
   * Safe even for products with sales history: sale_items snapshot product_name
   * and product_sku, so old invoices keep reading correctly. A hard delete is
   * what the database blocks (fn_prevent_product_delete_with_sales), and this
   * never issues one.
   */
  async delete(id: ProductId): Promise<Result<void>> {
    const existing = await this.getById(id);
    if (!existing.success) return existing;

    try {
      await this.repo.delete(id);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not delete product.') };
    }
  }

  /** Toggle active status. Separate from update() because the UI treats it as one click. */
  async setActive(id: ProductId, isActive: boolean): Promise<Result<Product>> {
    return this.update(id, { is_active: isActive });
  }

  /** Typeahead search for the sale form's line-item picker. */
  async search(query: string, limit?: number): Promise<Result<ProductLookupResult[]>> {
    try {
      return { success: true, data: await this.repo.search(this.orgId, query, limit) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Search failed.') };
    }
  }
}

// ── Internals ─────────────────────────────────────────────────────────────────

/** Zod reports every failed field; the UI shows one at a time. */
function firstIssue(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}

/** Postgres messages are for logs. Translate the ones a user can act on. */
function toMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  if (error.message.includes('products_organization_id_sku_key') || error.message.includes('duplicate key')) {
    return 'A product with that SKU already exists.';
  }

  if (error.message.includes('row-level security')) {
    return 'You do not have permission to do that.';
  }

  return fallback;
}
