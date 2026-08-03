/**
 * INVENTORY SERVICE
 *
 * Validates input, enforces tenancy, and translates thrown repository errors into
 * messages a shopkeeper can act on. Returns Results; the repository throws.
 *
 * Automatic stock movements — sale completion, cancellation, and line-item edits on
 * a completed sale — are handled by database triggers and are deliberately not
 * modelled here. This service covers the manual side: opening stock, deliveries,
 * damage, losses, and recounts.
 */

import type { InventoryRepository } from './repository';
import type {
  Inventory,
  InventoryLine,
  InventoryItem,
  InventoryAdjustment,
  InventoryAdjustmentReason,
  InventoryFilter,
  InventoryItemFilter,
  InventorySubjectRef,
} from './types';
import type {
  OrganizationId,
  InventoryItemId,
  Result,
  Money,
} from '@/lib/types/common';
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  adjustStockSchema,
  setCountSchema,
} from './schemas';

export class InventoryService {
  constructor(
    private repo: InventoryRepository,
    private orgId: OrganizationId
  ) {}

  /** Every stock row: products and non-sellable items together. */
  async list(
    filter?: Omit<InventoryFilter, 'organization_id'>
  ): Promise<Result<InventoryLine[]>> {
    try {
      return {
        success: true,
        data: await this.repo.findAll({ ...filter, organization_id: this.orgId }),
      };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load stock levels.') };
    }
  }

  /** Stock for one product or item. */
  async getBySubject(ref: InventorySubjectRef): Promise<Result<InventoryLine>> {
    try {
      const inventory = await this.repo.findBySubject(this.orgId, ref);

      if (!inventory) {
        return { success: false, error: 'No stock record found for that product or item.' };
      }

      return { success: true, data: inventory };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load the stock level.') };
    }
  }

  /**
   * Everything at or below its configured reorder level.
   *
   * A per-thing threshold rather than one global number: a shop reorders flour at
   * 20 sacks and carrier bags at 500. Things with no threshold set are absent
   * rather than treated as zero — see the note in the mapper.
   */
  async listLowStock(): Promise<Result<InventoryLine[]>> {
    return this.list({ low_stock_only: true });
  }

  /** Count for the dashboard badge. Zero on failure, since a badge cannot show an error. */
  async countLowStock(): Promise<number> {
    const result = await this.listLowStock();
    return result.success ? result.data.length : 0;
  }

  /**
   * Total value of everything on the shelves, at cost.
   *
   * At cost rather than sale price: this is money already spent that has not sold
   * yet, which is the figure that matters when deciding whether to order more.
   */
  async getTotalValue(): Promise<Result<Money>> {
    const result = await this.list();
    if (!result.success) return result;

    return {
      success: true,
      data: result.data.reduce((sum, line) => sum + line.stock_value, 0),
    };
  }

  // ── The item catalogue ──────────────────────────────────────────────────────

  async listItems(
    filter?: Omit<InventoryItemFilter, 'organization_id'>
  ): Promise<Result<InventoryItem[]>> {
    try {
      return {
        success: true,
        data: await this.repo.findAllItems({
          status: 'active',
          ...filter,
          organization_id: this.orgId,
        }),
      };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load items.') };
    }
  }

  /** Checks tenancy explicitly rather than relying on RLS alone, so a cross-tenant id reads as "not found". */
  async getItem(id: InventoryItemId): Promise<Result<InventoryItem>> {
    try {
      const item = await this.repo.findItemById(id);

      if (!item || item.organization_id !== this.orgId) {
        return { success: false, error: 'Item not found.' };
      }

      return { success: true, data: item };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load the item.') };
    }
  }

  async createItem(input: unknown): Promise<Result<InventoryItem>> {
    const parsed = createInventoryItemSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    try {
      return { success: true, data: await this.repo.createItem(this.orgId, parsed.data) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not create the item.') };
    }
  }

  async updateItem(id: InventoryItemId, input: unknown): Promise<Result<InventoryItem>> {
    const existing = await this.getItem(id);
    if (!existing.success) return existing;

    const parsed = updateInventoryItemSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    try {
      return { success: true, data: await this.repo.updateItem(id, parsed.data) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not update the item.') };
    }
  }

  async deleteItem(id: InventoryItemId): Promise<Result<void>> {
    const existing = await this.getItem(id);
    if (!existing.success) return existing;

    try {
      await this.repo.deleteItem(id);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not remove the item.') };
    }
  }

  // ── Moving stock ────────────────────────────────────────────────────────────

  /**
   * Apply a signed delta: positive for stock arriving, negative for stock leaving.
   *
   * The reason is required and logged. Without it the history reads as a series of
   * unexplained corrections, which answers nothing later.
   */
  async adjust(input: unknown): Promise<Result<Inventory>> {
    const parsed = adjustStockSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const { ref, delta, reason, notes } = parsed.data;

    try {
      return {
        success: true,
        data: await this.repo.adjust(
          this.orgId,
          ref as InventorySubjectRef,
          delta,
          reason as InventoryAdjustmentReason,
          notes
        ),
      };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not adjust the stock.') };
    }
  }

  /**
   * Correct stock to a physically counted figure.
   *
   * The delta is derived inside the database, under the same lock that applies it,
   * so nothing recorded between the count and the save is silently overwritten.
   */
  async setCount(input: unknown): Promise<Result<Inventory>> {
    const parsed = setCountSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const { ref, counted, notes } = parsed.data;

    try {
      return {
        success: true,
        data: await this.repo.setCount(this.orgId, ref as InventorySubjectRef, counted, notes),
      };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not correct the count.') };
    }
  }

  /** Stock history, newest first. Whole organization when ref is omitted. */
  async listAdjustments(
    ref?: InventorySubjectRef,
    limit?: number
  ): Promise<Result<InventoryAdjustment[]>> {
    try {
      return {
        success: true,
        data: await this.repo.findAdjustments(this.orgId, ref, limit),
      };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load the stock history.') };
    }
  }

  /**
   * Pre-flight check before completing a sale.
   *
   * The completion trigger enforces this too and raises a named error, but a list
   * of every shortage at once is more useful than failing on whichever line the
   * trigger reached first.
   */
  async checkAvailability(
    items: Array<{ product_id: string; product_name: string; quantity: number }>
  ): Promise<{
    canComplete: boolean;
    shortages: Array<{ product_name: string; available: number; needed: number }>;
  }> {
    const stock = await this.list({ kind: 'products' });

    if (!stock.success) {
      // Cannot verify, so claim nothing. The trigger is the real guard; this is an
      // early warning, and a false "all clear" would be worse than no answer.
      return { canComplete: false, shortages: [] };
    }

    const onHand = new Map<string, number>();
    for (const line of stock.data) {
      if (line.subject.kind === 'product') {
        onHand.set(line.subject.product_id, line.quantity_on_hand);
      }
    }

    const shortages = items
      .map((item) => ({
        product_name: item.product_name,
        available: onHand.get(item.product_id) ?? 0,
        needed: item.quantity,
      }))
      .filter((row) => row.available < row.needed);

    return { canComplete: shortages.length === 0, shortages };
  }
}

// ── Internals ─────────────────────────────────────────────────────────────────

function firstIssue(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}

function toMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  // Raised by adjust_inventory, which already names the thing and the quantity on
  // hand, so it passes through as written.
  if (error.message.includes('Not enough stock to remove')) {
    return error.message.replace(/^.*?Not enough stock/, 'Not enough stock');
  }

  if (error.message.includes('No stock record found')) {
    return 'No stock record found for that product or item.';
  }

  if (error.message.includes('The count already matches')) {
    return 'That count already matches what is recorded, so there is nothing to correct.';
  }

  if (error.message.includes('Adjustment quantity cannot be zero')) {
    return 'Enter how much stock came in or went out.';
  }

  if (error.message.includes('duplicate key') && error.message.includes('item_code')) {
    return 'An item with that code already exists.';
  }

  if (error.message.includes('permission to adjust stock')) {
    return 'You do not have permission to change stock levels.';
  }

  if (error.message.includes('Not authorized for this organization')) {
    return 'That record belongs to another organization.';
  }

  if (error.message.includes('row-level security')) {
    return 'You do not have permission to do that.';
  }

  return fallback;
}
