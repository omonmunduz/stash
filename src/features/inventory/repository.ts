/**
 * INVENTORY REPOSITORY
 *
 * Supabase-backed. Reads that find nothing return null or an empty collection;
 * anything else throws for the service to translate.
 *
 * Stock changes go through RPCs rather than an UPDATE plus an INSERT, because
 * moving stock and recording why must not be separable — a failure between them
 * produces a number that changed with no explanation, which is precisely what the
 * adjustment log exists to prevent. The RPCs also hold a row lock across the
 * read-modify-write, so two adjustments landing together cannot lose one another.
 */

import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';
import type {
  Inventory,
  InventoryLine,
  InventoryItem,
  InventoryAdjustment,
  InventoryAdjustmentReason,
  InventoryFilter,
  InventoryItemFilter,
  InventorySubjectRef,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
} from './types';
import type {
  OrganizationId,
  InventoryItemId,
  Quantity,
} from '@/lib/types/common';
import {
  inventoryBaseQuery,
  inventoryItemsBaseQuery,
  adjustmentsBaseQuery,
  applyItemSearch,
  INVENTORY_ITEM_COLUMNS,
} from './queries';
import { CATALOGUE_LIST_LIMIT } from '@/lib/constants/query-limits';
import {
  mapInventoryLine,
  mapInventoryItem,
  mapInventoryAdjustment,
  type InventoryRow,
} from './mapper';

type InventoryItemUpdate = Database['public']['Tables']['inventory_items']['Update'];

export interface InventoryRepository {
  /** Stock for one product or item, with its cost and reorder level. Null when no row exists. */
  findBySubject(
    organizationId: OrganizationId,
    ref: InventorySubjectRef
  ): Promise<InventoryLine | null>;

  /** Every stock row, with what it counts. */
  findAll(filter: InventoryFilter): Promise<InventoryLine[]>;

  /** The item catalogue. */
  findAllItems(filter: InventoryItemFilter): Promise<InventoryItem[]>;

  findItemById(id: InventoryItemId): Promise<InventoryItem | null>;

  createItem(
    organizationId: OrganizationId,
    input: CreateInventoryItemInput
  ): Promise<InventoryItem>;

  updateItem(id: InventoryItemId, input: UpdateInventoryItemInput): Promise<InventoryItem>;

  /** Soft delete, so historical adjustments keep naming something. */
  deleteItem(id: InventoryItemId): Promise<void>;

  /** Move stock by a signed delta and log why, atomically. */
  adjust(
    organizationId: OrganizationId,
    ref: InventorySubjectRef,
    delta: Quantity,
    reason: InventoryAdjustmentReason,
    notes: string | undefined
  ): Promise<Inventory>;

  /** Correct stock to a counted figure, deriving the delta under the row lock. */
  setCount(
    organizationId: OrganizationId,
    ref: InventorySubjectRef,
    counted: Quantity,
    notes: string | undefined
  ): Promise<Inventory>;

  /** Adjustment history, newest first. Whole organization when ref is omitted. */
  findAdjustments(
    organizationId: OrganizationId,
    ref?: InventorySubjectRef,
    limit?: number
  ): Promise<InventoryAdjustment[]>;
}

export class SupabaseInventoryRepository implements InventoryRepository {
  constructor(private supabase: SupabaseServerClient) {}

  async findBySubject(
    organizationId: OrganizationId,
    ref: InventorySubjectRef
  ): Promise<InventoryLine | null> {
    const query = inventoryBaseQuery(this.supabase, organizationId);

    const { data, error } = await (ref.kind === 'product'
      ? query.eq('product_id', ref.id)
      : query.eq('item_id', ref.id)
    ).maybeSingle();

    if (error) throw new Error(`Failed to load stock level: ${error.message}`);

    // The full line rather than bare Inventory: the base query already selects
    // both embeds, so cost price, reorder level, and unit of measure are already
    // in hand. The adjust screen needs the unit to label its quantity fields, and
    // a second narrower read to avoid carrying three extra fields would cost a
    // round trip to save nothing.
    return data ? mapInventoryLine(data as unknown as InventoryRow) : null;
  }

  async findAll(filter: InventoryFilter): Promise<InventoryLine[]> {
    let query = inventoryBaseQuery(this.supabase, filter.organization_id);

    // Narrowing by kind is a null check on the discriminating column, not a filter
    // on the embed — an embed filter would return the row with a null embed rather
    // than excluding it.
    if (filter.kind === 'products') query = query.not('product_id', 'is', null);
    if (filter.kind === 'items') query = query.not('item_id', 'is', null);

    // Ordered before the limit so the cap takes a deterministic slice rather than
    // whatever Postgres happened to return. There is no natural business order on
    // a stock row, so this sorts by the FK pair purely for stability — the real
    // ordering (low stock first, then name) is applied in memory below, since it
    // depends on comparing two columns across an embed.
    //
    // The cap interacts with the filters below it: low_stock_only and search run
    // in application code, so they only see rows the limit let through. One stock
    // row exists per product or item, so reaching 2,000 means a 2,000-line
    // catalogue — at which point this screen needs pagination regardless.
    const { data, error } = await query
      .order('product_id', { ascending: true, nullsFirst: false })
      .order('item_id', { ascending: true, nullsFirst: false })
      .limit(CATALOGUE_LIST_LIMIT);

    if (error) throw new Error(`Failed to load stock levels: ${error.message}`);

    let lines = (data ?? []).map((row) => mapInventoryLine(row as unknown as InventoryRow));

    // Filtered here rather than in SQL: quantity_on_hand <= reorder_level compares
    // two columns across an embed, which PostgREST cannot express.
    if (filter.low_stock_only) lines = lines.filter((line) => line.is_low_stock);

    if (filter.search) {
      const term = filter.search.toLowerCase();
      lines = lines.filter(
        (line) =>
          line.subject.name.toLowerCase().includes(term) ||
          line.subject.code.toLowerCase().includes(term)
      );
    }

    // Low stock first, then by name: the reason to open this screen is to find out
    // what needs ordering.
    return lines.sort((a, b) => {
      if (a.is_low_stock !== b.is_low_stock) return a.is_low_stock ? -1 : 1;
      return a.subject.name.localeCompare(b.subject.name);
    });
  }

  async findAllItems(filter: InventoryItemFilter): Promise<InventoryItem[]> {
    let query = inventoryItemsBaseQuery(this.supabase, filter.organization_id);

    if (filter.status === 'active') query = query.eq('is_active', true);
    if (filter.status === 'inactive') query = query.eq('is_active', false);
    if (filter.category) query = query.eq('category', filter.category);
    if (filter.search) query = applyItemSearch(query, filter.search);

    // Bound on the worst case, not pagination. Sorted by name, so the rows this
    // drops are the tail of the alphabet. See lib/constants/query-limits.
    const { data, error } = await query.order('name').limit(CATALOGUE_LIST_LIMIT);

    if (error) throw new Error(`Failed to list items: ${error.message}`);
    return (data ?? []).map(mapInventoryItem);
  }

  async findItemById(id: InventoryItemId): Promise<InventoryItem | null> {
    const { data, error } = await this.supabase
      .from('inventory_items')
      .select(INVENTORY_ITEM_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to load item: ${error.message}`);
    return data ? mapInventoryItem(data) : null;
  }

  async createItem(
    organizationId: OrganizationId,
    input: CreateInventoryItemInput
  ): Promise<InventoryItem> {
    // Generated server-side so two people adding an item at once cannot pick the
    // same code, the same way products and invoices do it.
    let itemCode = input.item_code?.trim();

    if (!itemCode) {
      const { data: generated, error: codeError } = await this.supabase.rpc(
        'generate_inventory_item_code',
        { org_id: organizationId }
      );

      if (codeError) throw new Error(`Failed to generate an item code: ${codeError.message}`);
      itemCode = generated as string;
    }

    const { data, error } = await this.supabase
      .from('inventory_items')
      .insert({
        organization_id: organizationId,
        item_code: itemCode,
        name: input.name,
        description: input.description ?? null,
        category: input.category ?? null,
        unit_of_measure: input.unit_of_measure ?? 'unit',
        cost_price: input.cost_price,
        reorder_level: input.reorder_level ?? null,
        image_url: input.image_url ?? null,
      })
      .select(INVENTORY_ITEM_COLUMNS)
      .single();

    if (error) throw new Error(`Failed to create item: ${error.message}`);

    const item = mapInventoryItem(data);

    // trg_create_inventory_for_item already made the stock row at 0, so opening
    // stock is an adjustment — which also logs it as initial_stock rather than
    // leaving the first quantity unexplained. Written separately rather than in one
    // transaction because a failure here leaves a valid item at zero stock,
    // recoverable from the stock screen, unlike a lost item.
    if (input.initial_quantity && input.initial_quantity > 0) {
      await this.adjust(
        organizationId,
        { kind: 'item', id: item.id },
        input.initial_quantity,
        'initial_stock',
        'Opening stock'
      );
    }

    return item;
  }

  async updateItem(
    id: InventoryItemId,
    input: UpdateInventoryItemInput
  ): Promise<InventoryItem> {
    // Undefined-skipping patch, same as products: spreading the whole input would
    // null out every field the edit form left alone.
    const patch: InventoryItemUpdate = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        patch[key as keyof InventoryItemUpdate] = value as never;
      }
    }

    if (Object.keys(patch).length === 0) {
      const existing = await this.findItemById(id);
      if (!existing) throw new Error('Item not found.');
      return existing;
    }

    const { data, error } = await this.supabase
      .from('inventory_items')
      .update(patch)
      .eq('id', id)
      .is('deleted_at', null)
      .select(INVENTORY_ITEM_COLUMNS)
      .single();

    if (error) throw new Error(`Failed to update item: ${error.message}`);
    return mapInventoryItem(data);
  }

  async deleteItem(id: InventoryItemId): Promise<void> {
    // Soft delete. Adjustment history references the item, and a hard delete would
    // cascade the log away — erasing the record of stock movements that did happen.
    const { error } = await this.supabase
      .from('inventory_items')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to remove item: ${error.message}`);
  }

  async adjust(
    organizationId: OrganizationId,
    ref: InventorySubjectRef,
    delta: Quantity,
    reason: InventoryAdjustmentReason,
    notes: string | undefined
  ): Promise<Inventory> {
    const { error } = await this.supabase.rpc('adjust_inventory', {
      p_organization_id: organizationId,
      // The function takes both and requires exactly one to be null. The generated
      // types declare them as plain strings because Postgres reports no
      // nullability for arguments, so the null is cast at this one boundary rather
      // than loosening the domain types.
      p_product_id: (ref.kind === 'product' ? ref.id : null) as string,
      p_item_id: (ref.kind === 'item' ? ref.id : null) as string,
      p_delta: delta,
      p_reason: reason,
      p_notes: notes,
    });

    if (error) throw new Error(`Failed to adjust stock: ${error.message}`);

    const updated = await this.findBySubject(organizationId, ref);
    if (!updated) throw new Error('Stock was adjusted but could not be read back.');
    return updated;
  }

  async setCount(
    organizationId: OrganizationId,
    ref: InventorySubjectRef,
    counted: Quantity,
    notes: string | undefined
  ): Promise<Inventory> {
    const { error } = await this.supabase.rpc('set_inventory_count', {
      p_organization_id: organizationId,
      p_product_id: (ref.kind === 'product' ? ref.id : null) as string,
      p_item_id: (ref.kind === 'item' ? ref.id : null) as string,
      p_counted: counted,
      p_notes: notes,
    });

    if (error) throw new Error(`Failed to correct the count: ${error.message}`);

    const updated = await this.findBySubject(organizationId, ref);
    if (!updated) throw new Error('The count was corrected but could not be read back.');
    return updated;
  }

  async findAdjustments(
    organizationId: OrganizationId,
    ref?: InventorySubjectRef,
    limit = 50
  ): Promise<InventoryAdjustment[]> {
    let query = adjustmentsBaseQuery(this.supabase, organizationId);

    if (ref?.kind === 'product') query = query.eq('product_id', ref.id);
    if (ref?.kind === 'item') query = query.eq('item_id', ref.id);

    const { data, error } = await query
      .order('adjusted_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to load stock history: ${error.message}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((row) => mapInventoryAdjustment(row as any));
  }
}
