/**
 * EXPENSE TRANSLATION HELPERS
 *
 * Shared helpers for translating expense categories and periods consistently.
 * System-defined categories are translated; user-created ones pass through unchanged.
 */

import type { ExpensePeriod } from './categories';

/**
 * Map of category display names to translation keys.
 */
const CATEGORY_KEY_MAP: Record<string, string> = {
  'Stock purchase': 'stockPurchase',
  'Transport': 'transport',
  'Rent': 'rent',
  'Salaries': 'salaries',
  'Utilities': 'utilities',
  'Packaging': 'packaging',
  'Airtime and data': 'airtimeAndData',
  'Repairs': 'repairs',
  'Licenses and fees': 'licensesAndFees',
  'Marketing': 'marketing',
};

/**
 * Get translated label for an expense category.
 * System-suggested categories use translation keys, user-created ones pass through.
 *
 * @param category - The category value from the database
 * @param t - Translation function for 'expenses.categories' namespace
 * @returns Translated label or original user-entered value
 */
export function getCategoryLabel(
  category: string,
  t: (key: string) => string
): string {
  // Check if this is a system-suggested category
  const key = CATEGORY_KEY_MAP[category];
  if (key) {
    return t(key);
  }

  // User-created category - return as-is
  return category;
}

/**
 * Get translated label for an expense period.
 *
 * @param period - The period value ('month' | 'quarter' | 'year' | 'all')
 * @param t - Translation function for 'expenses.periods' namespace
 * @returns Translated period label
 */
export function getPeriodLabel(
  period: ExpensePeriod,
  t: (key: string) => string
): string {
  return t(period);
}
