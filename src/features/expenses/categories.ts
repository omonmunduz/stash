/**
 * EXPENSE CATEGORIES AND PERIOD PRESETS
 *
 * Isomorphic: the form and filters (client) render these, the page (server) uses
 * the period helper to build its query, so the two cannot disagree about what
 * "this month" means.
 */

/**
 * Suggestions offered in the category field, not a fixed list.
 *
 * The column is free text and the schema comment says why — we cannot know what
 * categories a given business uses. But unconstrained free text makes "Rent",
 * "rent", and "RENT" three separate lines in a breakdown, which is the one thing
 * this field exists to prevent. A datalist splits the difference: tapping a
 * suggestion spells it the same way every time, and typing something else is
 * still allowed.
 *
 * Chosen for a small wholesale shop — the things that recur monthly, plus the
 * ones that come up buying and moving stock.
 */
export const EXPENSE_CATEGORY_SUGGESTIONS: readonly string[] = [
  'Stock purchase',
  'Transport',
  'Rent',
  'Salaries',
  'Utilities',
  'Packaging',
  'Airtime and data',
  'Repairs',
  'Licenses and fees',
  'Marketing',
];

export type ExpensePeriod = 'month' | 'quarter' | 'year' | 'all';

/**
 * A month by default.
 *
 * Longer than the payments day book's default for the same reason a shop looks at
 * takings daily but costs monthly: expenses arrive in ones and twos, and rent
 * once. A week of expenses is often an empty page.
 */
export const DEFAULT_EXPENSE_PERIOD: ExpensePeriod = 'month';

export const EXPENSE_PERIODS: ReadonlyArray<{
  value: ExpensePeriod;
  label: string;
}> = [
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'Last 3 months' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'Everything' },
];

/** Narrow a URL param to a period, falling back to the default. */
export function parseExpensePeriod(value: string | undefined): ExpensePeriod {
  return value === 'month' || value === 'quarter' || value === 'year' || value === 'all'
    ? value
    : DEFAULT_EXPENSE_PERIOD;
}

/**
 * The earliest expense_date a period includes, or undefined for 'all'.
 *
 * Undefined rather than a sentinel date so it drops into the service's optional
 * `dateFrom` — an omitted filter and one reaching back to 1970 are the same
 * query, and the omitted one says what it means.
 *
 * 'month' and 'year' are calendar-aligned; 'quarter' is a rolling three months
 * back from today rather than a calendar quarter. Someone asking for three months
 * of costs wants the last three months, not "since the quarter began", which on
 * the first of April would be a single day.
 *
 * Computed in the runtime's local timezone, like the payment periods. Correct for
 * a single-location shop; revisit when organizations carry a timezone.
 */
export function expensePeriodStart(
  period: ExpensePeriod,
  now: Date = new Date()
): Date | undefined {
  if (period === 'all') return undefined;

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'month') {
    start.setDate(1);
    return start;
  }

  if (period === 'quarter') {
    // setMonth handles the year rollover: month -2 in January becomes November of
    // the previous year.
    start.setMonth(start.getMonth() - 2);
    start.setDate(1);
    return start;
  }

  return new Date(now.getFullYear(), 0, 1);
}
