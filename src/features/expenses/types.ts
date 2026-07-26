/**
 * EXPENSE DOMAIN MODEL
 *
 * Expenses track money going OUT of the business: rent, salaries, utilities,
 * packaging supplies, transport, etc.
 *
 * Together with sales and payments, expenses give the owner a picture of
 * net profit: Revenue (sales) - Cost of Goods (from sale_items) - Expenses.
 *
 * Design decisions:
 * - category is free text: we cannot know what categories a given business uses
 * - vendor is optional: sometimes the payee is unknown or irrelevant
 * - receipt_url links to Supabase Storage: allows photo of receipt on mobile
 * - payment_method matches the payments table enum for consistency
 * - No sub-categories in MVP: simple category string is sufficient
 */

import type {
  ExpenseId,
  OrganizationId,
  UserId,
  Timestamps,
  Auditable,
  Money,
} from '@/lib/types/common';
import type { PaymentMethod } from '@/features/payments/types';

export interface Expense extends Timestamps, Auditable {
  id: ExpenseId;
  organization_id: OrganizationId;

  /** Human-readable number like EXP-2024-0001 */
  expense_number: string;

  expense_date: Date;

  /**
   * Free-text category. Examples: "Rent", "Salaries", "Transport",
   * "Packaging", "Utilities", "Marketing".
   * Phase 2: extract to a separate ExpenseCategory entity with autocomplete.
   */
  category: string;

  /** Name of who was paid. Optional. */
  vendor: string | null;

  amount: Money;
  payment_method: PaymentMethod;

  /** What the expense was for. Required to maintain a useful record. */
  description: string;

  /**
   * URL of receipt image stored in Supabase Storage.
   * null if no receipt was captured.
   */
  receipt_url: string | null;
}

/** Input for recording a new expense */
export interface CreateExpenseInput {
  expense_date?: Date; // defaults to today
  category: string;
  vendor?: string;
  amount: Money;
  payment_method: PaymentMethod;
  description: string;
  receipt_url?: string;
}

/** Input for updating an expense */
export interface UpdateExpenseInput {
  expense_date?: Date;
  category?: string;
  vendor?: string | null;
  amount?: Money;
  payment_method?: PaymentMethod;
  description?: string;
  receipt_url?: string | null;
}

/** Filter for querying expenses */
export interface ExpenseFilter {
  organization_id: OrganizationId;
  category?: string;
  payment_method?: PaymentMethod;
  date_from?: Date;
  date_to?: Date;
  /** Minimum amount */
  amount_min?: Money;
  /** Maximum amount */
  amount_max?: Money;
  search?: string;
}

/** Aggregated expense data for reporting */
export interface ExpenseSummary {
  category: string;
  total: Money;
  count: number;
  percentage_of_total: number;
}
