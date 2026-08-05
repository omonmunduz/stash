/**
 * CUSTOMER SERVICE
 *
 * Orchestrates customer operations. Server Actions call this; they never touch
 * the repository directly.
 *
 * Responsibilities that live here rather than in the repository:
 * - Input validation (Zod schemas)
 * - The delete guard (a customer who owes money cannot be removed)
 * - Turning thrown repository errors into Result values
 *
 * Every method is org-scoped through the constructor, so no call site can
 * forget to pass an organization ID.
 */

import type { CustomerRepository, CustomerLookupResult } from './repository';
import type { Customer, CustomerDebtSummary, CustomerFilter } from './types';
import type { CustomerId, OrganizationId, Result } from '@/lib/types/common';
import { createCustomerSchema, updateCustomerSchema } from './schemas';
import { getCustomerDisplayName, hasOutstandingBalance } from './business-rules';

/** Shape the list page filters by. */
export interface CustomerListOptions {
  search?: string;
  /** 'all' includes inactive customers; defaults to active only. */
  status?: 'active' | 'inactive' | 'all';
  /** Restrict to customers with an outstanding balance. */
  hasBalance?: boolean;
}

export class CustomerService {
  constructor(
    private repo: CustomerRepository,
    private orgId: OrganizationId
  ) {}

  /** List customers for the main list page. */
  async list(options: CustomerListOptions = {}): Promise<Result<Customer[]>> {
    const filter: CustomerFilter = {
      organization_id: this.orgId,
      search: options.search,
      has_balance: options.hasBalance,
    };

    // 'all' means "do not filter", which is why is_active stays undefined
    // rather than being set to a boolean.
    if (options.status === 'active' || options.status === undefined) {
      filter.is_active = true;
    } else if (options.status === 'inactive') {
      filter.is_active = false;
    }

    try {
      return { success: true, data: await this.repo.findAll(filter) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load customers.') };
    }
  }

  /**
   * Load one customer.
   *
   * Verifies the customer belongs to the caller's organization even though RLS
   * enforces it. A cross-tenant ID should read as "not found" rather than
   * relying on the policy alone to hide it.
   */
  async getById(id: CustomerId): Promise<Result<Customer>> {
    try {
      const customer = await this.repo.findById(id);

      if (!customer || customer.organization_id !== this.orgId) {
        return { success: false, error: 'Customer not found.' };
      }

      return { success: true, data: customer };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load customer.') };
    }
  }

  /**
   * Customer id → display name, for lists that show a name per row and nothing
   * else about the customer.
   *
   * Returns the map rather than the rows because every caller was building the
   * same one, and because the display-name rule (business_name, falling back to
   * name) belongs on this side of the boundary rather than in a page.
   *
   * Keyed by plain string: the components declare `Map<string, string>`, and a
   * Map's key type is invariant, so handing back `Map<CustomerId, string>` would
   * not be assignable to it. Lookups still typecheck, since a CustomerId is a
   * string.
   */
  async listNames(): Promise<Result<Map<string, string>>> {
    try {
      const rows = await this.repo.findNames(this.orgId);
      const names = new Map<string, string>();

      for (const row of rows) {
        names.set(row.id, getCustomerDisplayName(row));
      }

      return { success: true, data: names };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load customer names.') };
    }
  }

  /** Customers who owe money, richest debt first — the receivables view. */
  async listWithBalance(): Promise<Result<CustomerDebtSummary[]>> {
    try {
      return { success: true, data: await this.repo.findWithBalance(this.orgId) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load outstanding balances.') };
    }
  }

  /** Total outstanding across the organization — for the list page summary. */
  async getTotalReceivable(): Promise<number> {
    const result = await this.listWithBalance();
    if (!result.success) return 0;
    return result.data.reduce((sum, customer) => sum + customer.current_balance, 0);
  }

  /**
   * Create a customer.
   *
   * Takes raw unknown input and validates here, so a Server Action can hand
   * over a form payload without pre-parsing it.
   */
  async create(input: unknown): Promise<Result<Customer>> {
    const parsed = createCustomerSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }

    // phoneSchema and creditLimitSchema are .nullable().optional(), so both
    // arrive as `T | null | undefined`. CreateCustomerInput admits only
    // `T | undefined` — on create, "absent" and "null" mean the same thing
    // (no phone recorded, no limit enforced), so collapse null to undefined.
    // On update they differ, which is why UpdateCustomerInput keeps null.
    const normalized = {
      ...parsed.data,
      phone: parsed.data.phone ?? undefined,
      credit_limit: parsed.data.credit_limit ?? undefined,
    };

    try {
      return { success: true, data: await this.repo.create(this.orgId, normalized) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not create customer.') };
    }
  }

  /** Update a customer. Confirms tenancy before writing. */
  async update(id: CustomerId, input: unknown): Promise<Result<Customer>> {
    const parsed = updateCustomerSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }

    const existing = await this.getById(id);
    if (!existing.success) return existing;

    try {
      return { success: true, data: await this.repo.update(id, parsed.data) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not update customer.') };
    }
  }

  /**
   * Soft-delete a customer.
   *
   * Blocked while they owe money. Deleting a debtor would hide the debt from
   * every report while leaving their invoices in place — the balance would
   * simply stop being counted. Deactivating is the correct action for a
   * customer who has stopped buying but still owes.
   */
  async delete(id: CustomerId): Promise<Result<void>> {
    const existing = await this.getById(id);
    if (!existing.success) return existing;

    if (hasOutstandingBalance(existing.data)) {
      return {
        success: false,
        error: `${existing.data.name} still owes ${existing.data.current_balance.toFixed(2)}. Record the payment first, or deactivate them instead of deleting.`,
      };
    }

    try {
      await this.repo.delete(id);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not delete customer.') };
    }
  }

  /** Toggle active status. Separate from update() because the UI treats it as one click. */
  async setActive(id: CustomerId, isActive: boolean): Promise<Result<Customer>> {
    return this.update(id, { is_active: isActive });
  }

  /** Typeahead search for sale entry. */
  async search(query: string, limit?: number): Promise<Result<CustomerLookupResult[]>> {
    try {
      return { success: true, data: await this.repo.search(this.orgId, query, limit) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Search failed.') };
    }
  }
}

// ── Internals ─────────────────────────────────────────────────────────────────

/**
 * Zod reports every failed field; the UI shows one message at a time. Taking
 * the first issue keeps errors actionable instead of dumping a list.
 */
function firstIssue(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}

/**
 * Repository errors carry Postgres messages, which are useful in logs and
 * confusing in a UI. Constraint violations get a human translation; anything
 * else falls back to the caller's generic message.
 */
function toMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  if (error.message.includes('customers_code_unique') || error.message.includes('duplicate key')) {
    return 'A customer with that code already exists.';
  }

  if (error.message.includes('row-level security')) {
    return 'You do not have permission to do that.';
  }

  return fallback;
}
