/**
 * PAYMENT PERIOD PRESETS
 *
 * The day book asks one of four questions: what came in today, this week, this
 * month, or ever. Those are presets rather than a date-range picker because
 * "how much did I take today" should be one tap, not two calendars.
 *
 * Isomorphic on purpose. The filter component (client) renders these labels and
 * the page (server) turns the chosen value into a date for the query, so the two
 * cannot drift apart on what 'week' means.
 *
 * Dates are computed in the runtime's local timezone. For a single-location shop
 * that is the right answer — "today" means the day the shopkeeper is standing in,
 * not UTC. It does mean a server in another timezone would disagree at the
 * margins; when this grows past one location, the organization's timezone becomes
 * the thing to compute against.
 */

export type PaymentPeriod = 'today' | 'week' | 'month' | 'all';

/** The default: a month is long enough to be useful, short enough to scan. */
export const DEFAULT_PAYMENT_PERIOD: PaymentPeriod = 'month';

export const PAYMENT_PERIODS: ReadonlyArray<{
  value: PaymentPeriod;
  label: string;
}> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'Everything' },
];

/**
 * Narrow a URL param to a period, falling back to the default.
 *
 * A junk value quietly becomes the default instead of erroring: a mistyped query
 * string is not worth a broken page on a screen someone opens to check takings.
 */
export function parsePaymentPeriod(value: string | undefined): PaymentPeriod {
  return value === 'today' || value === 'week' || value === 'month' || value === 'all'
    ? value
    : DEFAULT_PAYMENT_PERIOD;
}

/**
 * The earliest payment_date a period includes, or undefined for 'all'.
 *
 * Undefined rather than a sentinel date so it drops straight into the service's
 * optional `dateFrom` — an omitted filter and a filter reaching back to 1970 are
 * the same query, and the omitted one says what it means.
 *
 * No upper bound is returned. Payments are not dated in the future, and leaving
 * dateTo open means a payment recorded a minute ago still shows in "today".
 */
export function paymentPeriodStart(period: PaymentPeriod, now: Date = new Date()): Date | undefined {
  if (period === 'all') return undefined;

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'today') return start;

  if (period === 'week') {
    // Monday, because a shop's week does. getDay() is Sunday-based, so Sunday
    // counts back six days rather than starting a fresh week.
    const daysSinceMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
    return start;
  }

  start.setDate(1);
  return start;
}
