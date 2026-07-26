/**
 * EXPENSE REPOSITORY INTERFACE
 */

import type {
  Expense,
  ExpenseSummary,
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseFilter,
} from './types';
import type { ExpenseId, OrganizationId, Money } from '@/lib/types/common';

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

  /** Get the next sequence number for expense_number generation. */
  getNextSequenceNumber(organizationId: OrganizationId, year?: number): Promise<number>;
}
