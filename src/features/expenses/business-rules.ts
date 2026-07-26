/**
 * EXPENSE BUSINESS RULES
 *
 * Domain logic for expense tracking and reporting.
 * Pure functions — no database calls.
 */

import type { Expense, ExpenseSummary } from './types';
import type { Money } from '@/lib/types/common';

/**
 * Generate an expense number from a sequence.
 * Format: EXP-YYYY-NNNN
 */
export function generateExpenseNumber(sequenceNumber: number, year?: number): string {
  const y = year ?? new Date().getFullYear();
  return `EXP-${y}-${String(sequenceNumber).padStart(4, '0')}`;
}

/**
 * Sum the total amount for a list of expenses.
 */
export function calculateTotalExpenses(expenses: Expense[]): Money {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Group expenses by category and calculate totals and percentages.
 * Returns array sorted by total descending.
 */
export function summarizeByCategory(expenses: Expense[]): ExpenseSummary[] {
  if (expenses.length === 0) return [];

  const grandTotal = calculateTotalExpenses(expenses);

  const grouped = expenses.reduce<Record<string, { total: Money; count: number }>>(
    (acc, expense) => {
      const key = expense.category;
      if (!acc[key]) acc[key] = { total: 0, count: 0 };
      acc[key].total += expense.amount;
      acc[key].count += 1;
      return acc;
    },
    {}
  );

  return Object.entries(grouped)
    .map(([category, { total, count }]) => ({
      category,
      total,
      count,
      percentage_of_total: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Filter expenses to a specific date range (inclusive).
 */
export function filterByDateRange(
  expenses: Expense[],
  from: Date,
  to: Date
): Expense[] {
  return expenses.filter(
    (e) => e.expense_date >= from && e.expense_date <= to
  );
}

/**
 * Calculate net profit for a period:
 * Revenue (from sales) minus cost of goods minus expenses.
 *
 * Note: this function only handles the expense side.
 * The sale/payment modules provide revenue figures.
 */
export function calculateNetProfit(
  grossProfit: Money,
  expenses: Expense[]
): Money {
  return grossProfit - calculateTotalExpenses(expenses);
}
