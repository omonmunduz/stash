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
import type {
  SaleId,
  SaleItemId,
  CustomerId,
  OrganizationId,
  Result,
} from '@/lib/types/common';
import {
  createSaleWithItemsSchema,
  updateSaleSchema,
  upsertSaleItemSchema,
} from './schemas';
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
   * Add a line to a sale, or correct an existing one.
   *
   * The heavy lifting is one RPC: stock moves by the difference between the old
   * and new quantity, the sale total is recalculated from its lines, and the
   * customer's payments are re-applied oldest-first so a total that moved does
   * not leave an invoice claiming money it no longer has. What is done here is
   * the part that needs the catalog: resolving the product so an omitted price
   * falls back to the current sale_price, and refusing a line whose product is
   * gone before the RPC reports it as a constraint violation.
   */
  async upsertItem(saleId: SaleId, input: unknown): Promise<Result<SaleWithItems>> {
    const parsed = upsertSaleItemSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }

    const existing = await this.getWithItems(saleId);
    if (!existing.success) return existing;

    if (existing.data.status === 'cancelled') {
      return { success: false, error: 'This sale is cancelled. Lines cannot be changed.' };
    }

    const product = await this.productRepo.findById(brandId<'ProductId'>(parsed.data.product_id));

    if (!product || product.organization_id !== this.orgId) {
      return { success: false, error: 'That product no longer exists.' };
    }

    const unitPrice = parsed.data.unit_price ?? product.sale_price;
    const discount = parsed.data.discount ?? 0;

    if (parsed.data.quantity * unitPrice - discount < 0) {
      return { success: false, error: 'The discount is more than the line is worth.' };
    }

    try {
      return {
        success: true,
        data: await this.repo.upsertItem(this.orgId, saleId, {
          id: parsed.data.item_id ? brandId<'SaleItemId'>(parsed.data.item_id) : undefined,
          product_id: brandId<'ProductId'>(parsed.data.product_id),
          quantity: parsed.data.quantity,
          unit_price: unitPrice,
          discount,
        }),
      };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not save the line.') };
    }
  }

  /**
   * Remove a line from a sale. Its stock goes back and the total drops.
   *
   * The last line is refused rather than allowed through: a sale with no lines
   * has a total of zero and reads as settled, which is indistinguishable from a
   * paid invoice on every screen. Cancelling the sale says the same thing
   * honestly.
   */
  async removeItem(saleId: SaleId, itemId: SaleItemId): Promise<Result<SaleWithItems>> {
    const existing = await this.getWithItems(saleId);
    if (!existing.success) return existing;

    if (existing.data.status === 'cancelled') {
      return { success: false, error: 'This sale is cancelled. Lines cannot be changed.' };
    }

    if (!existing.data.items.some((item) => item.id === itemId)) {
      return { success: false, error: 'That line is not on this sale.' };
    }

    if (existing.data.items.length === 1) {
      return {
        success: false,
        error: 'This is the only line on the sale. Cancel the whole sale instead.',
      };
    }

    try {
      return { success: true, data: await this.repo.removeItem(this.orgId, saleId, itemId) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not remove the line.') };
    }
  }

  /**
   * Cancel a sale. Stock goes back on the shelf, the debt comes off the tab, and
   * any payments that were applied to it are released.
   *
   * Released, not deleted: the payment rows stand — the money was really handed
   * over — but their allocations to this sale are dropped and the customer's
   * remaining invoices are re-paid oldest-first. Whatever is left over sits as
   * credit on the account. Before this was in place the allocations stayed
   * pointing at the cancelled sale, where they counted as neither debt nor
   * credit, and the money quietly left the balance.
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

  /**
   * Void a sale: cancel it, then hide it.
   *
   * This is what "delete this transaction" does. The row survives so the invoice
   * number stays accounted for and the allocation history remains readable, but
   * it leaves every list and stops affecting the tab. A sale entered against the
   * wrong customer is the case this exists for.
   */
  async void(id: SaleId): Promise<Result<void>> {
    const existing = await this.getWithItems(id);
    if (!existing.success) return existing;

    try {
      await this.repo.void(this.orgId, id);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not delete the sale.') };
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

  // Raised by upsert_sale_item / remove_sale_item / void_sale. Each is already
  // worded for the person who hit it, so it passes through rather than being
  // flattened into a generic failure.
  if (error.message.includes('Insufficient stock to increase')) {
    return error.message.replace(/^.*?Insufficient stock/, 'Insufficient stock');
  }

  if (error.message.includes('last line on a sale')) {
    return 'A sale needs at least one line. Delete the whole transaction instead.';
  }

  if (error.message.includes('cancelled sale cannot be edited')) {
    return 'This sale is cancelled, so its lines can no longer be changed.';
  }

  if (error.message.includes('Line not found')) {
    return 'That line is no longer on this sale — it may have just been removed.';
  }

  if (error.message.includes('row-level security')) {
    return 'You do not have permission to do that.';
  }

  return fallback;
}
