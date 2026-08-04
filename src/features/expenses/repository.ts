/**
 * EXPENSE REPOSITORY
 *
 * Interface plus the Supabase implementation.
 *
 * Unlike payments, nothing here needs an RPC. An expense touches one row and no
 * other table's totals: there is no allocation to walk, no customer balance to
 * move, no stock to deduct. A plain insert is the whole operation, so the
 * concurrency argument that put record_customer_payment in the database does not
 * apply.
 *
 * The one exception is expense_number. The column is NOT NULL with no default and
 * no insert trigger, so something has to fill it — and generating it here from a
 * MAX() read would let two people logging an expense at the same moment pick the
 * same number and collide on UNIQUE(organization_id, expense_number).
 * generate_expense_number does the read and increment inside one statement, the
 * same way customers and inventory items get their codes.
 */

import type {
  Expense,
  ExpenseSummary,
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseFilter,
} from './types';
import type { ExpenseId, OrganizationId, Money } from '@/lib/types/common';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';
import { mapExpense } from './mapper';
import { summarizeByCategory as summarizeRows } from './business-rules';
import {
  EXPENSE_COLUMNS,
  expensesListQuery,
  applyExpenseSearch,
} from './queries';

type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];

export interface ExpenseRepository {
  /** Find an expense by ID. */
  findById(id: ExpenseId): Promise<Expense | null>;

  /** List expenses with optional filtering. */
  findAll(filter: ExpenseFilter): Promise<Expense[]>;

  /**
   * Get expense totals grouped by category.
   * Used in expense breakdown reports.
   */
  summarizeByCategory(
    organizationId: OrganizationId,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<ExpenseSummary[]>;

  /**
   * Sum all expenses in a date range.
   * Used in profit/loss reports.
   */
  sumForPeriod(organizationId: OrganizationId, from: Date, to: Date): Promise<Money>;

  /** Create an expense record. */
  create(organizationId: OrganizationId, input: CreateExpenseInput): Promise<Expense>;

  /** Update an expense. */
  update(id: ExpenseId, input: UpdateExpenseInput): Promise<Expense>;

  /** Soft-delete an expense. */
  delete(id: ExpenseId): Promise<void>;

  /**
   * The distinct categories this organization has actually used, alphabetical.
   *
   * Drives the category filter. Separate from summarizeByCategory because that
   * one reads whole rows to compute totals and percentages, and a dropdown needs
   * neither — see the note on the implementation.
   */
  findDistinctCategories(organizationId: OrganizationId): Promise<string[]>;

  /** Get the next sequence number for expense_number generation. */
  getNextSequenceNumber(organizationId: OrganizationId, year?: number): Promise<number>;
}

/**
 * Supabase-backed expense repository. Reads that find nothing return null or an
 * empty collection; anything else throws for the service to translate.
 */
export class SupabaseExpenseRepository implements ExpenseRepository {
  constructor(private supabase: SupabaseServerClient) {}

  async findById(id: ExpenseId): Promise<Expense | null> {
    const { data, error } = await this.supabase
      .from('expenses')
      .select(EXPENSE_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to load expense: ${error.message}`);
    return data ? mapExpense(data) : null;
  }

  async findAll(filter: ExpenseFilter): Promise<Expense[]> {
    let query = expensesListQuery(this.supabase, filter.organization_id);

    if (filter.category) query = query.eq('category', filter.category);
    if (filter.payment_method) query = query.eq('payment_method', filter.payment_method);
    if (filter.date_from) query = query.gte('expense_date', toDateOnly(filter.date_from));
    if (filter.date_to) query = query.lte('expense_date', toDateOnly(filter.date_to));
    if (filter.amount_min !== undefined) query = query.gte('amount', filter.amount_min);
    if (filter.amount_max !== undefined) query = query.lte('amount', filter.amount_max);
    if (filter.search?.trim()) query = applyExpenseSearch(query, filter.search);

    const { data, error } = await query;

    if (error) throw new Error(`Failed to list expenses: ${error.message}`);
    return (data ?? []).map(mapExpense);
  }

  /**
   * Grouped in memory rather than with a database GROUP BY.
   *
   * PostgREST cannot express "group by category with a percentage of the whole"
   * without a dedicated view or RPC, and the percentage needs the grand total
   * anyway. summarizeByCategory in business-rules already computes exactly this
   * shape and is unit-testable without a database, so the rows are fetched and
   * handed to it. A single organization's expenses for a reporting period is a
   * few hundred rows at the scale this serves; revisit with a view if that stops
   * being true.
   */
  async summarizeByCategory(
    organizationId: OrganizationId,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<ExpenseSummary[]> {
    const expenses = await this.findAll({
      organization_id: organizationId,
      date_from: dateFrom,
      date_to: dateTo,
    });

    return summarizeRows(expenses);
  }

  /**
   * Every category name this organization has used, A–Z.
   *
   * Selects one column and dedupes here, because PostgREST has no DISTINCT. The
   * alternative was deriving the filter's options from the rows already on the
   * page, which breaks the moment a filter is applied: pick "Rent", the page
   * returns only Rent rows, and every other option vanishes from the dropdown
   * that would let you switch back.
   *
   * Unscoped by date for the same reason — a category should not disappear from
   * the list because you happen to be looking at a week it saw no spending.
   */
  async findDistinctCategories(organizationId: OrganizationId): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('expenses')
      .select('category')
      .eq('organization_id', organizationId)
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to load expense categories: ${error.message}`);

    return [...new Set((data ?? []).map((row) => row.category))].sort((a, b) =>
      a.localeCompare(b)
    );
  }

  /**
   * Sums only the amount column — the full rows are not needed, and a
   * profit report asking for a year of expenses should not pull a year of
   * descriptions across the wire to add up fifteen numbers.
   */
  async sumForPeriod(
    organizationId: OrganizationId,
    from: Date,
    to: Date
  ): Promise<Money> {
    const { data, error } = await this.supabase
      .from('expenses')
      .select('amount')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .gte('expense_date', toDateOnly(from))
      .lte('expense_date', toDateOnly(to));

    if (error) throw new Error(`Failed to total expenses: ${error.message}`);

    return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
  }

  async create(
    organizationId: OrganizationId,
    input: CreateExpenseInput
  ): Promise<Expense> {
    // Generated in the database for the same reason customer codes are: two
    // callers reading MAX() at once would produce the same number and one insert
    // would fail the UNIQUE constraint.
    const { data: expenseNumber, error: numberError } = await this.supabase.rpc(
      'generate_expense_number',
      { org_id: organizationId }
    );

    if (numberError || !expenseNumber) {
      throw new Error(
        `Failed to generate an expense number: ${numberError?.message ?? 'no number returned'}`
      );
    }

    const { data, error } = await this.supabase
      .from('expenses')
      .insert({
        organization_id: organizationId,
        expense_number: expenseNumber,
        // The column defaults to CURRENT_DATE, but the default is the server's
        // date. Sending the caller's date keeps an expense logged late at night
        // on the day the user picked.
        expense_date: toDateOnly(input.expense_date ?? new Date()),
        category: input.category,
        vendor: input.vendor ?? null,
        amount: input.amount,
        payment_method: input.payment_method,
        description: input.description,
        receipt_url: input.receipt_url ?? null,
      })
      .select(EXPENSE_COLUMNS)
      .single();

    if (error) throw new Error(`Failed to create expense: ${error.message}`);
    return mapExpense(data);
  }

  async update(id: ExpenseId, input: UpdateExpenseInput): Promise<Expense> {
    // Only the fields actually present are sent. An undefined key would be
    // serialized as null by PostgREST and blank the column.
    const patch: ExpenseUpdate = {};

    if (input.expense_date !== undefined) {
      patch.expense_date = toDateOnly(input.expense_date);
    }
    if (input.category !== undefined) patch.category = input.category;
    if (input.vendor !== undefined) patch.vendor = input.vendor;
    if (input.amount !== undefined) patch.amount = input.amount;
    if (input.payment_method !== undefined) patch.payment_method = input.payment_method;
    if (input.description !== undefined) patch.description = input.description;
    if (input.receipt_url !== undefined) patch.receipt_url = input.receipt_url;

    const { data, error } = await this.supabase
      .from('expenses')
      .update(patch)
      .eq('id', id)
      .is('deleted_at', null)
      .select(EXPENSE_COLUMNS)
      .single();

    if (error) throw new Error(`Failed to update expense: ${error.message}`);
    return mapExpense(data);
  }

  async delete(id: ExpenseId): Promise<void> {
    // Soft delete. A deleted expense still has to be absent from this year's
    // profit figure and present in the audit trail, and there is no DELETE
    // policy on the table anyway — expenses_update_manager_or_above is the only
    // way a row is ever modified.
    const { error } = await this.supabase
      .from('expenses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to delete expense: ${error.message}`);
  }

  async getNextSequenceNumber(organizationId: OrganizationId): Promise<number> {
    const { data, error } = await this.supabase.rpc('generate_expense_number', {
      org_id: organizationId,
    });

    if (error || !data) {
      throw new Error(
        `Failed to get next expense sequence: ${error?.message ?? 'no number returned'}`
      );
    }

    // The SQL function returns a formatted number (EXP-2026-0007); callers of
    // this method want the integer. Parsed back rather than duplicating the
    // MAX() query here, matching the customer repository.
    const match = data.match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : 1;
  }
}

// ── Internals ─────────────────────────────────────────────────────────────────

/**
 * expense_date is a DATE column, not a timestamp. Sending a full ISO string
 * shifts the date across a timezone boundary for anyone east or west of UTC — an
 * expense entered at 9pm local could land on tomorrow's books. Formatting from
 * the local calendar parts keeps the date the user picked.
 */
function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
