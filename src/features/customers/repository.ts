/**
 * CUSTOMER REPOSITORY
 *
 * Interface plus the Supabase implementation.
 *
 * The interface exists so the service layer can be tested against a fake and
 * so a future move off Supabase touches one file. The implementation lives
 * alongside it rather than in a separate file because there is exactly one,
 * and splitting a 60-line contract from its only implementor adds a hop
 * without adding clarity.
 */

import type {
  Customer,
  CustomerDebtSummary,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerFilter,
} from './types';
import type { CustomerId, OrganizationId, Money } from '@/lib/types/common';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';
import { mapCustomer, mapCustomerDebtSummary } from './mapper';
import {
  CUSTOMER_COLUMNS,
  CUSTOMER_LOOKUP_COLUMNS,
  applyCustomerSearch,
  customersBaseQuery,
} from './queries';

type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

export interface CustomerRepository {
  /** Find customer by ID. Returns null if not found or soft-deleted. */
  findById(id: CustomerId): Promise<Customer | null>;

  /** Find customer by their human-readable code (CUST-0001). */
  findByCode(code: string, organizationId: OrganizationId): Promise<Customer | null>;

  /** List all customers in an organization with optional filtering. */
  findAll(filter: CustomerFilter): Promise<Customer[]>;

  /**
   * Find customers with outstanding balances — for accounts receivable report.
   * Returns customers who have current_balance > 0, ordered by balance descending.
   */
  findWithBalance(organizationId: OrganizationId): Promise<CustomerDebtSummary[]>;

  /** Create a new customer. customer_code is auto-generated if not provided. */
  create(organizationId: OrganizationId, input: CreateCustomerInput): Promise<Customer>;

  /** Update customer details. */
  update(id: CustomerId, input: UpdateCustomerInput): Promise<Customer>;

  /** Soft-delete a customer. Fails if customer has open sales (amount_due > 0). */
  delete(id: CustomerId): Promise<void>;

  /**
   * Get the next available sequence number for customer_code generation.
   * Used by business rules to generate CUST-NNNN codes.
   */
  getNextSequenceNumber(organizationId: OrganizationId): Promise<number>;

  /**
   * Directly update a customer's current_balance.
   * Called by server-side logic when triggers are bypassed (e.g. bulk operations).
   * Under normal operation, triggers handle this automatically.
   */
  updateBalance(id: CustomerId, newBalance: Money): Promise<void>;

  /**
   * Search customers by name, business_name, or phone for quick-select dropdowns.
   * Returns lightweight results for performance.
   */
  search(
    organizationId: OrganizationId,
    query: string,
    limit?: number
  ): Promise<Pick<Customer, 'id' | 'customer_code' | 'name' | 'business_name' | 'current_balance' | 'credit_limit'>[]>;
}

/** Lightweight shape returned by search() for quick-select dropdowns. */
export type CustomerLookupResult = Pick<
  Customer,
  'id' | 'customer_code' | 'name' | 'business_name' | 'current_balance' | 'credit_limit'
>;

/**
 * Supabase-backed customer repository.
 *
 * Error policy: reads that find nothing return null or an empty array; reads
 * and writes that fail for any other reason throw. The service layer converts
 * those throws into Result values at the boundary the UI consumes, so the
 * repository never has to decide what a user-facing error message looks like.
 */
export class SupabaseCustomerRepository implements CustomerRepository {
  constructor(private supabase: SupabaseServerClient) {}

  async findById(id: CustomerId): Promise<Customer | null> {
    const { data, error } = await this.supabase
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to load customer: ${error.message}`);
    return data ? mapCustomer(data) : null;
  }

  async findByCode(code: string, organizationId: OrganizationId): Promise<Customer | null> {
    const { data, error } = await this.supabase
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .eq('organization_id', organizationId)
      .eq('customer_code', code)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to load customer by code: ${error.message}`);
    return data ? mapCustomer(data) : null;
  }

  async findAll(filter: CustomerFilter): Promise<Customer[]> {
    let query = customersBaseQuery(this.supabase, filter.organization_id);

    if (filter.is_active !== undefined) {
      query = query.eq('is_active', filter.is_active);
    }

    // has_balance is a debt filter, not a sort: `> 0` excludes both settled
    // customers (0) and those in credit from an overpayment (negative).
    if (filter.has_balance) {
      query = query.gt('current_balance', 0);
    }

    if (filter.search) {
      query = applyCustomerSearch(query, filter.search);
    }

    // Balance descending puts "who owes me the most" at the top, which is the
    // question this list exists to answer. Name is the tiebreaker so the order
    // is stable across reloads when many customers owe nothing.
    const { data, error } = await query
      .order('current_balance', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to list customers: ${error.message}`);
    return (data ?? []).map(mapCustomer);
  }

  async findWithBalance(organizationId: OrganizationId): Promise<CustomerDebtSummary[]> {
    const { data, error } = await this.supabase
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .gt('current_balance', 0)
      .order('current_balance', { ascending: false });

    if (error) throw new Error(`Failed to load receivables: ${error.message}`);

    const customers = data ?? [];
    if (customers.length === 0) return [];

    // Two batch queries instead of N+1: fetch every open sale and payment for
    // this set of customers at once, then group in memory. At small-business
    // scale (hundreds of customers, thousands of sales) this is far cheaper
    // than a per-customer round trip, and it keeps the aggregation logic
    // readable versus pushing it into a SQL view we would have to migrate.
    const customerIds = customers.map((c) => c.id);

    const [salesResult, paymentsResult] = await Promise.all([
      this.supabase
        .from('sales')
        .select('customer_id, sale_date, amount_due')
        .eq('organization_id', organizationId)
        .in('customer_id', customerIds)
        .eq('status', 'completed')
        .is('deleted_at', null),
      this.supabase
        .from('payments')
        .select('customer_id, payment_date')
        .eq('organization_id', organizationId)
        .in('customer_id', customerIds)
        .is('deleted_at', null),
    ]);

    if (salesResult.error) {
      throw new Error(`Failed to load sales for receivables: ${salesResult.error.message}`);
    }
    if (paymentsResult.error) {
      throw new Error(`Failed to load payments for receivables: ${paymentsResult.error.message}`);
    }

    const byCustomer = new Map<
      string,
      { open_sales_count: number; total_outstanding: number; last_sale_date: string | null }
    >();

    for (const sale of salesResult.data ?? []) {
      const entry = byCustomer.get(sale.customer_id) ?? {
        open_sales_count: 0,
        total_outstanding: 0,
        last_sale_date: null,
      };

      const due = sale.amount_due ?? 0;
      if (due > 0) {
        entry.open_sales_count += 1;
        entry.total_outstanding += due;
      }
      if (!entry.last_sale_date || sale.sale_date > entry.last_sale_date) {
        entry.last_sale_date = sale.sale_date;
      }

      byCustomer.set(sale.customer_id, entry);
    }

    const lastPaymentByCustomer = new Map<string, string>();
    for (const payment of paymentsResult.data ?? []) {
      const current = lastPaymentByCustomer.get(payment.customer_id);
      if (!current || payment.payment_date > current) {
        lastPaymentByCustomer.set(payment.customer_id, payment.payment_date);
      }
    }

    return customers.map((row) =>
      mapCustomerDebtSummary(row, {
        open_sales_count: byCustomer.get(row.id)?.open_sales_count ?? 0,
        total_outstanding: byCustomer.get(row.id)?.total_outstanding ?? 0,
        last_sale_date: byCustomer.get(row.id)?.last_sale_date ?? null,
        last_payment_date: lastPaymentByCustomer.get(row.id) ?? null,
      })
    );
  }

  async create(organizationId: OrganizationId, input: CreateCustomerInput): Promise<Customer> {
    // customer_code generation runs in the database, not here. Two callers
    // creating a customer at the same moment would otherwise both read the same
    // MAX() and produce a duplicate code; the SQL function reads and increments
    // inside a single statement.
    let customerCode = input.customer_code;

    if (!customerCode) {
      const { data: generated, error: codeError } = await this.supabase.rpc(
        'generate_customer_code',
        { org_id: organizationId }
      );

      if (codeError || !generated) {
        throw new Error(`Failed to generate customer code: ${codeError?.message ?? 'no code returned'}`);
      }
      customerCode = generated;
    }

    const { data, error } = await this.supabase
      .from('customers')
      .insert({
        organization_id: organizationId,
        customer_code: customerCode,
        name: input.name,
        business_name: input.business_name ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        credit_limit: input.credit_limit ?? null,
        notes: input.notes ?? null,
        // current_balance is deliberately omitted — triggers own it.
      })
      .select(CUSTOMER_COLUMNS)
      .single();

    if (error) throw new Error(`Failed to create customer: ${error.message}`);
    return mapCustomer(data);
  }

  async update(id: CustomerId, input: UpdateCustomerInput): Promise<Customer> {
    // Only send keys the caller actually supplied. Spreading the whole input
    // would write explicit nulls over existing values for every field the edit
    // form did not touch.
    //
    // Typed as the table's Update shape rather than Record<string, unknown> so
    // a field renamed in the domain but not in the database fails to compile
    // here instead of silently writing nothing.
    const patch: CustomerUpdate = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        patch[key as keyof CustomerUpdate] = value as never;
      }
    }

    if (Object.keys(patch).length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error('Customer not found.');
      return existing;
    }

    const { data, error } = await this.supabase
      .from('customers')
      .update(patch)
      .eq('id', id)
      .is('deleted_at', null)
      .select(CUSTOMER_COLUMNS)
      .single();

    if (error) throw new Error(`Failed to update customer: ${error.message}`);
    return mapCustomer(data);
  }

  async delete(id: CustomerId): Promise<void> {
    // Soft delete only. Sales reference customers, and a customer's history is
    // the record of money owed — hard-deleting would orphan invoices. The
    // open-balance check that guards this lives in the service layer, which can
    // return a message the UI can show.
    const { error } = await this.supabase
      .from('customers')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to delete customer: ${error.message}`);
  }

  async getNextSequenceNumber(organizationId: OrganizationId): Promise<number> {
    const { data, error } = await this.supabase.rpc('generate_customer_code', {
      org_id: organizationId,
    });

    if (error || !data) {
      throw new Error(`Failed to get next customer sequence: ${error?.message ?? 'no code returned'}`);
    }

    // The SQL function returns a formatted code; callers of this method want the
    // number. Parsing it back is redundant work, but it keeps sequence
    // generation in one place rather than duplicating the MAX() query here.
    const match = data.match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : 1;
  }

  async updateBalance(id: CustomerId, newBalance: Money): Promise<void> {
    const { error } = await this.supabase
      .from('customers')
      .update({ current_balance: newBalance })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to update customer balance: ${error.message}`);
  }

  async search(
    organizationId: OrganizationId,
    query: string,
    limit: number = 10
  ): Promise<CustomerLookupResult[]> {
    let builder = this.supabase
      .from('customers')
      .select(CUSTOMER_LOOKUP_COLUMNS)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .eq('is_active', true);

    if (query.trim()) {
      builder = applyCustomerSearch(builder, query);
    }

    const { data, error } = await builder.order('name', { ascending: true }).limit(limit);

    if (error) throw new Error(`Customer search failed: ${error.message}`);

    return (data ?? []).map((row) => ({
      id: row.id as CustomerLookupResult['id'],
      customer_code: row.customer_code,
      name: row.name,
      business_name: row.business_name,
      current_balance: row.current_balance ?? 0,
      credit_limit: row.credit_limit,
    }));
  }
}
