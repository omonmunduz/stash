/**
 * SALE REPOSITORY
 *
 * Interface plus the Supabase implementation. Sale items live here rather than in
 * their own repository because an item is only ever reached through its parent
 * sale.
 *
 * Why create() takes items instead of an addItem() loop:
 * a sale is one transaction. Inserting a header, then items, then flipping the
 * status from the client means three round trips, any of which can fail and
 * leave a numbered invoice with no goods on it, or goods deducted from stock
 * with no invoice. create_sale_with_items does the whole thing in one
 * statement — if a line item references a missing product, or stock runs short,
 * the entire sale rolls back and the customer's tab is untouched.
 */

import type {
  Sale,
  SaleItem,
  SaleWithItems,
  SaleWithDetails,
  CreateSaleWithItemsInput,
  UpdateSaleInput,
  UpsertSaleItemInput,
  SaleFilter,
} from './types';
import type {
  SaleId,
  SaleItemId,
  OrganizationId,
  CustomerId,
  Money,
} from '@/lib/types/common';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';
import { mapSale, mapSaleItem } from './mapper';
import {
  SALE_COLUMNS,
  SALE_ITEM_COLUMNS,
  salesBaseQuery,
  salesByCustomerQuery,
  overdueSalesQuery,
  saleWithItemsQuery,
  saleWithDetailsQuery,
} from './queries';
import { TRANSACTION_LIST_LIMIT } from '@/lib/constants/query-limits';

type SaleUpdate = Database['public']['Tables']['sales']['Update'];

export interface SaleRepository {
  /** Find a sale by ID. Returns null if not found or soft-deleted. */
  findById(id: SaleId): Promise<Sale | null>;

  /** Find a sale with all its line items. */
  findWithItems(id: SaleId): Promise<SaleWithItems | null>;

  /** Find a sale with items, customer, and the payments applied to it. */
  findWithDetails(id: SaleId): Promise<SaleWithDetails | null>;

  /** List sales with optional filtering, newest first. */
  findAll(filter: SaleFilter): Promise<Sale[]>;

  /** Every sale on one customer's tab, drafts included, newest first. */
  findByCustomer(organizationId: OrganizationId, customerId: CustomerId): Promise<Sale[]>;

  /** Completed sales past their due date and not fully paid. */
  findOverdue(organizationId: OrganizationId): Promise<Sale[]>;

  /** Line items for several sales at once, keyed by sale_id. Avoids an N+1. */
  findItemsForSales(saleIds: SaleId[]): Promise<Map<string, SaleItem[]>>;

  /**
   * Create a completed sale with its line items and any upfront payment, in one
   * transaction. Returns the new sale.
   */
  createWithItems(
    organizationId: OrganizationId,
    input: CreateSaleWithItemsInput
  ): Promise<Sale>;

  /** Update sale-level fields (notes, due_date). */
  update(id: SaleId, input: UpdateSaleInput): Promise<Sale>;

  /**
   * Add a line to a sale, or correct an existing one. Stock moves by the
   * difference, the sale total is recalculated, and the customer's payments are
   * re-applied oldest-first — all in one transaction.
   */
  upsertItem(
    organizationId: OrganizationId,
    saleId: SaleId,
    input: UpsertSaleItemInput
  ): Promise<SaleWithItems>;

  /** Remove a line from a sale, returning its stock and recalculating the total. */
  removeItem(
    organizationId: OrganizationId,
    saleId: SaleId,
    itemId: SaleItemId
  ): Promise<SaleWithItems>;

  /**
   * Mark a sale as cancelled. If it was completed, a DB trigger restores the
   * stock and the customer's balance drops by the amount that was outstanding.
   */
  cancel(id: SaleId): Promise<Sale>;

  /**
   * Void a sale: cancel it and soft-delete it in one step, so it leaves every
   * list while staying on record. Payments that were covering it become account
   * credit rather than vanishing.
   */
  void(organizationId: OrganizationId, id: SaleId): Promise<void>;

  /** Sum the total of completed sales in a period. For reports. */
  sumRevenueForPeriod(organizationId: OrganizationId, from: Date, to: Date): Promise<Money>;
}

/**
 * Supabase-backed sale repository.
 *
 * Error policy matches the customer repository: reads that find nothing return
 * null or an empty collection, everything else throws for the service layer to
 * translate.
 */
export class SupabaseSaleRepository implements SaleRepository {
  constructor(private supabase: SupabaseServerClient) {}

  async findById(id: SaleId): Promise<Sale | null> {
    const { data, error } = await this.supabase
      .from('sales')
      .select(SALE_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to load sale: ${error.message}`);
    return data ? mapSale(data) : null;
  }

  async findWithItems(id: SaleId): Promise<SaleWithItems | null> {
    const [saleResult, itemsResult] = await Promise.all([
      this.findById(id),
      this.supabase
        .from('sale_items')
        .select(SALE_ITEM_COLUMNS)
        .eq('sale_id', id)
        .order('created_at', { ascending: true }),
    ]);

    if (itemsResult.error) {
      throw new Error(`Failed to load sale items: ${itemsResult.error.message}`);
    }
    if (!saleResult) return null;

    return { ...saleResult, items: (itemsResult.data ?? []).map(mapSaleItem) };
  }

  async findWithDetails(id: SaleId): Promise<SaleWithDetails | null> {
    const withItems = await this.findWithItems(id);
    if (!withItems) return null;

    const [customerResult, allocationsResult] = await Promise.all([
      this.supabase
        .from('customers')
        .select('id, customer_code, name, business_name, phone')
        .eq('id', withItems.customer_id)
        .maybeSingle(),
      // Read the allocation rows and their payments. The allocation amount is
      // what landed on THIS sale; the payment's own amount may be larger because
      // it was split across several invoices.
      this.supabase
        .from('payment_allocations')
        .select(
          'id, amount, payment:payments ( id, payment_number, amount, payment_method, payment_date, reference_number, deleted_at )'
        )
        .eq('sale_id', id),
    ]);

    if (customerResult.error) {
      throw new Error(`Failed to load sale customer: ${customerResult.error.message}`);
    }
    if (allocationsResult.error) {
      throw new Error(`Failed to load sale payments: ${allocationsResult.error.message}`);
    }
    if (!customerResult.data) return null;

    const customer = customerResult.data;

    const payments = (allocationsResult.data ?? [])
      // A voided payment keeps its allocation rows so the history stays
      // auditable, but it no longer counts toward what the invoice received.
      .filter((row) => row.payment && !row.payment.deleted_at)
      .map((row) => ({
        id: row.payment!.id,
        payment_number: row.payment!.payment_number,
        /** What this payment applied to this sale, not the payment's full value. */
        amount: row.amount,
        payment_date: new Date(row.payment!.payment_date),
        payment_method: row.payment!.payment_method,
        reference_number: row.payment!.reference_number,
      }))
      .sort((a, b) => b.payment_date.getTime() - a.payment_date.getTime());

    return {
      ...withItems,
      customer: {
        id: customer.id as SaleWithDetails['customer']['id'],
        name: customer.name,
        business_name: customer.business_name,
        customer_code: customer.customer_code,
        phone: customer.phone,
      },
      payments,
    };
  }

  async findAll(filter: SaleFilter): Promise<Sale[]> {
    let query = salesBaseQuery(this.supabase, filter.organization_id);

    if (filter.customer_id) query = query.eq('customer_id', filter.customer_id);
    if (filter.status) query = query.eq('status', filter.status);
    if (filter.payment_status) query = query.eq('payment_status', filter.payment_status);
    if (filter.date_from) query = query.gte('sale_date', toDateOnly(filter.date_from));
    if (filter.date_to) query = query.lte('sale_date', toDateOnly(filter.date_to));

    if (filter.overdue_only) {
      query = query
        .eq('status', 'completed')
        .in('payment_status', ['unpaid', 'partial'])
        .lt('due_date', toDateOnly(new Date()));
    }

    // sale_number is the natural search target, but it is NULL on drafts, so
    // ilike alone would silently drop them. Callers wanting drafts search by
    // customer instead.
    if (filter.search?.trim()) {
      query = query.ilike('sale_number', `%${filter.search.trim()}%`);
    }

    // Bound on the worst case, not pagination. The sort is newest-first, so the
    // rows this drops are the oldest. See lib/constants/query-limits.
    const { data, error } = await query
      .order('sale_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(TRANSACTION_LIST_LIMIT);

    if (error) throw new Error(`Failed to list sales: ${error.message}`);
    return (data ?? []).map(mapSale);
  }

  async findByCustomer(
    organizationId: OrganizationId,
    customerId: CustomerId
  ): Promise<Sale[]> {
    const { data, error } = await salesByCustomerQuery(
      this.supabase,
      organizationId,
      customerId
    );

    if (error) throw new Error(`Failed to load customer sales: ${error.message}`);
    return (data ?? []).map(mapSale);
  }

  async findOverdue(organizationId: OrganizationId): Promise<Sale[]> {
    const { data, error } = await overdueSalesQuery(this.supabase, organizationId);

    if (error) throw new Error(`Failed to load overdue sales: ${error.message}`);
    return (data ?? []).map(mapSale);
  }

  async findItemsForSales(saleIds: SaleId[]): Promise<Map<string, SaleItem[]>> {
    const grouped = new Map<string, SaleItem[]>();
    if (saleIds.length === 0) return grouped;

    const { data, error } = await this.supabase
      .from('sale_items')
      .select(SALE_ITEM_COLUMNS)
      .in('sale_id', saleIds)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to load sale items: ${error.message}`);

    for (const row of data ?? []) {
      const item = mapSaleItem(row);
      const existing = grouped.get(row.sale_id);
      if (existing) existing.push(item);
      else grouped.set(row.sale_id, [item]);
    }

    return grouped;
  }

  async createWithItems(
    organizationId: OrganizationId,
    input: CreateSaleWithItemsInput
  ): Promise<Sale> {
    const { data: saleId, error } = await this.supabase.rpc('create_sale_with_items', {
      p_organization_id: organizationId,
      p_customer_id: input.customer_id,
      p_items: input.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount ?? 0,
      })),
      p_sale_date: toDateOnly(input.sale_date ?? new Date()),
      // p_due_date and p_notes are DEFAULT NULL in the function, so leaving them
      // out is the same as passing null — and the generated types only allow the
      // omission.
      p_due_date: input.due_date ? toDateOnly(input.due_date) : undefined,
      p_notes: input.notes ?? undefined,
      p_amount_paid: input.amount_paid ?? 0,
      p_payment_method: input.payment_method ?? 'cash',
    });

    if (error) throw new Error(`Failed to create sale: ${error.message}`);
    if (!saleId) throw new Error('Failed to create sale: no sale ID returned.');

    const sale = await this.findById(saleId as SaleId);
    if (!sale) throw new Error('Sale was created but could not be read back.');
    return sale;
  }

  async update(id: SaleId, input: UpdateSaleInput): Promise<Sale> {
    // Same undefined-skipping patch as the customer repository: only write keys
    // the caller supplied, so an edit form that omits a field does not null it.
    const patch: SaleUpdate = {};
    if (input.sale_date !== undefined) patch.sale_date = toDateOnly(input.sale_date);
    if (input.due_date !== undefined) {
      patch.due_date = input.due_date ? toDateOnly(input.due_date) : null;
    }
    if (input.notes !== undefined) patch.notes = input.notes;

    if (Object.keys(patch).length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error('Sale not found.');
      return existing;
    }

    const { data, error } = await this.supabase
      .from('sales')
      .update(patch)
      .eq('id', id)
      .is('deleted_at', null)
      .select(SALE_COLUMNS)
      .single();

    if (error) throw new Error(`Failed to update sale: ${error.message}`);
    return mapSale(data);
  }

  async upsertItem(
    organizationId: OrganizationId,
    saleId: SaleId,
    input: UpsertSaleItemInput
  ): Promise<SaleWithItems> {
    const { error } = await this.supabase.rpc('upsert_sale_item', {
      p_organization_id: organizationId,
      p_sale_id: saleId,
      // Omitted rather than null for a new line: p_item_id IS NULL is what tells
      // upsert_sale_item to insert, and an absent argument takes the same default.
      p_item_id: input.id ?? undefined,
      p_product_id: input.product_id,
      p_quantity: input.quantity,
      p_unit_price: input.unit_price,
      p_discount: input.discount ?? 0,
    });

    if (error) throw new Error(`Failed to save the line: ${error.message}`);

    const sale = await this.findWithItems(saleId);
    if (!sale) throw new Error('Line saved but the sale could not be read back.');
    return sale;
  }

  async removeItem(
    organizationId: OrganizationId,
    saleId: SaleId,
    itemId: SaleItemId
  ): Promise<SaleWithItems> {
    const { error } = await this.supabase.rpc('remove_sale_item', {
      p_organization_id: organizationId,
      p_sale_id: saleId,
      p_item_id: itemId,
    });

    if (error) throw new Error(`Failed to remove the line: ${error.message}`);

    const sale = await this.findWithItems(saleId);
    if (!sale) throw new Error('Line removed but the sale could not be read back.');
    return sale;
  }

  async cancel(id: SaleId): Promise<Sale> {
    const { data, error } = await this.supabase
      .from('sales')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .is('deleted_at', null)
      .select(SALE_COLUMNS)
      .single();

    if (error) throw new Error(`Failed to cancel sale: ${error.message}`);
    return mapSale(data);
  }

  async void(organizationId: OrganizationId, id: SaleId): Promise<void> {
    // One RPC rather than an update to status followed by one to deleted_at: the
    // cancel path restores stock and releases payments, and a client that died
    // between the two writes would leave a cancelled-but-visible sale.
    const { error } = await this.supabase.rpc('void_sale', {
      p_organization_id: organizationId,
      p_sale_id: id,
    });

    if (error) throw new Error(`Failed to void sale: ${error.message}`);
  }

  async sumRevenueForPeriod(
    organizationId: OrganizationId,
    from: Date,
    to: Date
  ): Promise<Money> {
    const { data, error } = await this.supabase
      .from('sales')
      .select('total')
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .gte('sale_date', toDateOnly(from))
      .lte('sale_date', toDateOnly(to))
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to sum revenue: ${error.message}`);
    return (data ?? []).reduce((sum, row) => sum + (row.total ?? 0), 0);
  }
}

// ── Internals ─────────────────────────────────────────────────────────────────

/**
 * sale_date and due_date are DATE columns, not timestamps. Sending a full ISO
 * string works but shifts the date across a timezone boundary for anyone east or
 * west of UTC — a sale entered at 9pm local could land on tomorrow's books.
 * Formatting from the local calendar parts keeps the date the user picked.
 */
function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
