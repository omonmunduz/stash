/**
 * SALE SERVICE
 *
 * Orchestrates sale operations. Server Actions call this; they never touch the
 * repository directly.
 *
 * Responsibilities that live here rather than in the repository:
 * - Input validation (Zod)
 * - Filling in each line's unit price from the product catalog when the form
 *   left it alone, and rejecting lines whose product does not exist
 * - The credit-limit check
 * - Turning thrown repository errors into Result values
 */

import type { SaleRepository } from './repository';
import type { ProductRepository } from '@/features/products/repository';
import type { CustomerRepository } from '@/features/customers/repository';
import type {
  Sale,
  SaleWithItems,
  SaleWithDetails,
  SaleFilter,
  SaleStatus,
  SalePaymentStatus,
  CreateSaleItemInput,
} from './types';
import type { SaleId, CustomerId, OrganizationId, Result } from '@/lib/types/common';
import { createSaleWithItemsSchema, updateSaleSchema } from './schemas';
import { checkCreditForSale } from '@/features/customers/business-rules';
import { brandId } from '@/lib/types/common';

/** Shape the sales list page filters by. */
export interface SaleListOptions {
  customerId?: CustomerId;
  status?: SaleStatus;
  paymentStatus?: SalePaymentStatus;
  overdueOnly?: boolean;
  search?: string;
}

/** A sale that was created, plus anything the user should know about it. */
export interface CreateSaleResult {
  sale: Sale;
  /**
   * Set when the sale went through but pushed the customer past their credit
   * limit. Not an error — the goods have already left the shelf by the time
   * anyone is looking at a screen, and blocking the record would just mean the
   * debt goes untracked.
   */
  creditWarning?: string;
}

export class SaleService {
  constructor(
    private repo: SaleRepository,
    private productRepo: ProductRepository,
    private customerRepo: CustomerRepository,
    private orgId: OrganizationId
  ) {}

  /** List sales for the main list page. */
  async list(options: SaleListOptions = {}): Promise<Result<Sale[]>> {
    const filter: SaleFilter = {
      organization_id: this.orgId,
      customer_id: options.customerId,
      status: options.status,
      payment_status: options.paymentStatus,
      overdue_only: options.overdueOnly,
      search: options.search,
    };

    try {
      return { success: true, data: await this.repo.findAll(filter) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load sales.') };
    }
  }

  /**
   * Load one sale with its line items.
   *
   * Checks tenancy explicitly rather than relying on RLS alone, so a
   * cross-tenant ID reads as "not found".
   */
  async getWithItems(id: SaleId): Promise<Result<SaleWithItems>> {
    try {
      const sale = await this.repo.findWithItems(id);

      if (!sale || sale.organization_id !== this.orgId) {
        return { success: false, error: 'Sale not found.' };
      }

      return { success: true, data: sale };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load sale.') };
    }
  }

  /** Load one sale with items, customer, and the payments applied to it. */
  async getWithDetails(id: SaleId): Promise<Result<SaleWithDetails>> {
    try {
      const sale = await this.repo.findWithDetails(id);

      if (!sale || sale.organization_id !== this.orgId) {
        return { success: false, error: 'Sale not found.' };
      }

      return { success: true, data: sale };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load sale.') };
    }
  }

  /** Every sale on one customer's tab, drafts included. */
  async listByCustomer(customerId: CustomerId): Promise<Result<Sale[]>> {
    try {
      return { success: true, data: await this.repo.findByCustomer(this.orgId, customerId) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load customer sales.') };
    }
  }

  /** Completed sales past their due date and not fully paid. */
  async listOverdue(): Promise<Result<Sale[]>> {
    try {
      return { success: true, data: await this.repo.findOverdue(this.orgId) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load overdue sales.') };
    }
  }

  /**
   * Record a completed sale with its line items and any upfront payment.
   *
   * The sale is created as one database transaction, so a line referencing a
   * deleted product or a shortfall in stock leaves nothing behind — no invoice
   * number consumed, no stock moved, no debt added to the tab.
   */
  async create(input: unknown): Promise<Result<CreateSaleResult>> {
    const parsed = createSaleWithItemsSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }

    const customer = await this.customerRepo.findById(brandId<'CustomerId'>(parsed.data.customer_id));

    if (!customer || customer.organization_id !== this.orgId) {
      return { success: false, error: 'Customer not found.' };
    }

    if (!customer.is_active) {
      return {
        success: false,
        error: `${customer.name} is inactive. Reactivate them before recording a sale.`,
      };
    }

    // Resolve every line against the catalog in one pass. Two things happen here:
    // a line the form left without a price picks up the product's current
    // sale_price, and a product that does not exist (or belongs to another
    // organization) fails now with the product's position in the list, rather
    // than as an opaque foreign-key error from the RPC.
    const items: CreateSaleItemInput[] = [];

    for (const [index, line] of parsed.data.items.entries()) {
      const product = await this.productRepo.findById(brandId<'ProductId'>(line.product_id));

      if (!product || product.organization_id !== this.orgId) {
        return { success: false, error: `Line ${index + 1}: that product no longer exists.` };
      }

      if (!product.is_active) {
        return {
          success: false,
          error: `Line ${index + 1}: "${product.name}" is inactive and cannot be sold.`,
        };
      }

      const unitPrice = line.unit_price ?? product.sale_price;
      const discount = line.discount ?? 0;

      if (line.quantity * unitPrice - discount < 0) {
        return {
          success: false,
          error: `Line ${index + 1}: the discount is more than the line is worth.`,
        };
      }

      items.push({
        product_id: brandId<'ProductId'>(line.product_id),
        quantity: line.quantity,
        unit_price: unitPrice,
        discount,
      });
    }

    const total = items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price - (item.discount ?? 0),
      0
    );
    const amountPaid = parsed.data.amount_paid ?? 0;

    // The credit check runs on what will still be owed after whatever was handed
    // over at the counter, not on the sale total. Paying in full for a large
    // order does not touch the tab and should not warn.
    const creditCheck = checkCreditForSale(customer, Math.max(0, total - amountPaid));

    try {
      const sale = await this.repo.createWithItems(this.orgId, {
        customer_id: brandId<'CustomerId'>(parsed.data.customer_id),
        items,
        sale_date: parsed.data.sale_date,
        due_date: parsed.data.due_date ?? null,
        notes: parsed.data.notes ?? null,
        amount_paid: amountPaid,
        payment_method: parsed.data.payment_method,
      });

      return {
        success: true,
        data: {
          sale,
          creditWarning: creditCheck.success ? undefined : creditCheck.error.message,
        },
      };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not record the sale.') };
    }
  }

  /** Update sale-level fields. Confirms tenancy before writing. */
  async update(id: SaleId, input: unknown): Promise<Result<Sale>> {
    const parsed = updateSaleSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }

    const existing = await this.getWithItems(id);
    if (!existing.success) return existing;

    try {
      return { success: true, data: await this.repo.update(id, parsed.data) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not update the sale.') };
    }
  }

  /**
   * Cancel a sale. Stock goes back on the shelf and the customer's tab drops by
   * whatever was still outstanding.
   *
   * Payments already taken against it are deliberately left alone: the money is
   * real and still belongs to the customer, so it becomes account credit instead
   * of silently disappearing. Voiding it is a separate, explicit act.
   */
  async cancel(id: SaleId): Promise<Result<Sale>> {
    const existing = await this.getWithItems(id);
    if (!existing.success) return existing;

    if (existing.data.status === 'cancelled') {
      return { success: false, error: 'This sale is already cancelled.' };
    }

    try {
      return { success: true, data: await this.repo.cancel(id) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not cancel the sale.') };
    }
  }
}

// ── Internals ─────────────────────────────────────────────────────────────────

/** Zod reports every failed field; the UI shows one at a time. */
function firstIssue(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}

/**
 * Repository errors carry Postgres messages. The ones a user can act on get a
 * human translation; everything else falls back to the caller's message.
 */
function toMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  // Raised by fn_deduct_inventory_on_sale, which already names the product and
  // the quantities, so it passes through as-is.
  if (error.message.includes('Insufficient stock')) {
    return error.message.replace(/^.*?Insufficient stock/, 'Insufficient stock');
  }

  if (error.message.includes('Product not found')) {
    return 'One of the products on this sale no longer exists.';
  }

  if (error.message.includes('row-level security')) {
    return 'You do not have permission to do that.';
  }

  return fallback;
}
