/**
 * EXPENSE SERVICE
 *
 * Orchestrates expense recording. Server Actions call this; they never touch the
 * repository directly.
 *
 * Responsibilities that live here rather than in the repository:
 * - Input validation (Zod)
 * - Confirming the record belongs to this organization before touching it
 * - Turning thrown repository errors into Result values
 *
 * Thinner than the payment service, and that is the domain rather than an
 * omission: an expense has no counterparty to verify, no invoices to apply itself
 * to, and no balance to move. Money left the business, and the record says so.
 */

import type { ExpenseRepository } from './repository';
import type { Expense, ExpenseSummary, ExpenseFilter } from './types';
import type { PaymentMethod } from '@/features/payments/types';
import type { ExpenseId, OrganizationId, Money, Result } from '@/lib/types/common';
import { createExpenseSchema, updateExpenseSchema } from './schemas';

/** Shape an expenses query filters by. */
export interface ExpenseListOptions {
  category?: string;
  method?: PaymentMethod;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export class ExpenseService {
  constructor(
    private repo: ExpenseRepository,
    private orgId: OrganizationId
  ) {}

  /** List expenses, newest first. */
  async list(options: ExpenseListOptions = {}): Promise<Result<Expense[]>> {
    const filter: ExpenseFilter = {
      organization_id: this.orgId,
      category: options.category,
      payment_method: options.method,
      date_from: options.dateFrom,
      date_to: options.dateTo,
      search: options.search,
    };

    try {
      return { success: true, data: await this.repo.findAll(filter) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load expenses.') };
    }
  }

  /** Load one expense, confirming tenancy. */
  async getById(id: ExpenseId): Promise<Result<Expense>> {
    try {
      const expense = await this.repo.findById(id);

      if (!expense || expense.organization_id !== this.orgId) {
        return { success: false, error: 'Expense not found.' };
      }

      return { success: true, data: expense };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not load expense.') };
    }
  }

  /** Record money spent. */
  async create(input: unknown): Promise<Result<Expense>> {
    const parsed = createExpenseSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }

    try {
      return {
        success: true,
        data: await this.repo.create(this.orgId, parsed.data),
      };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not record the expense.') };
    }
  }

  /** Correct an expense. */
  async update(id: ExpenseId, input: unknown): Promise<Result<Expense>> {
    const parsed = updateExpenseSchema.safeParse(input);

    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }

    // Tenancy is checked before the write rather than trusting RLS to refuse it.
    // RLS would, but the failure would surface as a row-not-found error the user
    // cannot act on, instead of a sentence saying the record is not theirs.
    const existing = await this.getById(id);
    if (!existing.success) return existing;

    try {
      return {
        success: true,
        data: await this.repo.update(id, parsed.data),
      };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not update the expense.') };
    }
  }

  /**
   * Remove an expense.
   *
   * Soft delete — it stops counting against profit but stays in the audit trail.
   * No guard on age or category: unlike voiding a payment, nothing downstream
   * depends on an expense, so there is nothing to leave inconsistent.
   */
  async remove(id: ExpenseId): Promise<Result<void>> {
    const existing = await this.getById(id);
    if (!existing.success) return existing;

    try {
      await this.repo.delete(id);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not delete the expense.') };
    }
  }

  /** Totals by category, for the breakdown on the list page and reports later. */
  async summarize(
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<Result<ExpenseSummary[]>> {
    try {
      return {
        success: true,
        data: await this.repo.summarizeByCategory(this.orgId, dateFrom, dateTo),
      };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not summarize expenses.') };
    }
  }

  /**
   * The categories this organization has used, for the filter dropdown.
   *
   * Returns an empty list rather than a failure when the read breaks. A missing
   * dropdown option is a degraded filter; an error banner over a working list of
   * expenses would be a worse answer to "show me what I spent".
   */
  async categories(): Promise<string[]> {
    try {
      return await this.repo.findDistinctCategories(this.orgId);
    } catch {
      return [];
    }
  }

  /** Total spent in a period. For profit reporting. */
  async totalForPeriod(from: Date, to: Date): Promise<Result<Money>> {
    try {
      return { success: true, data: await this.repo.sumForPeriod(this.orgId, from, to) };
    } catch (error) {
      return { success: false, error: toMessage(error, 'Could not total expenses.') };
    }
  }
}

// ── Internals ─────────────────────────────────────────────────────────────────

function firstIssue(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}

function toMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  // The UNIQUE(organization_id, expense_number) constraint. Reachable if two
  // inserts race past generate_expense_number, which the function is written to
  // prevent — but a duplicate key surfacing as "could not record" would send the
  // user looking for a mistake in what they typed.
  if (error.message.includes('duplicate key') || error.message.includes('23505')) {
    return 'That expense number is already taken. Try saving again.';
  }

  if (error.message.includes('row-level security')) {
    return 'You do not have permission to do that.';
  }

  if (error.message.includes('violates check constraint')) {
    return 'Amount must be greater than zero.';
  }

  return fallback;
}
