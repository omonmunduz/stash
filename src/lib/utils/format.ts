/**
 * Application-wide formatting utilities.
 *
 * All display formatting lives here so:
 * - Locale changes only need to happen in one place
 * - UI components never format directly
 * - Consistent formatting across the entire app
 */

// ── Money ─────────────────────────────────────────────────────────────────────

/**
 * Format a money amount for display.
 *
 * Examples:
 *   formatMoney(1234.5)         → "1,234.50"
 *   formatMoney(1234.5, 'KGS') → "1,234.50 KGS"
 *   formatMoney(0)             → "0.00"
 */
export function formatMoney(amount: number, currency?: string): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return currency ? `${formatted} ${currency}` : formatted;
}

/**
 * Format a money amount with sign for delta displays.
 *
 * Examples:
 *   formatMoneyDelta(500)  → "+500.00"
 *   formatMoneyDelta(-200) → "-200.00"
 */
export function formatMoneyDelta(amount: number, currency?: string): string {
  const sign = amount >= 0 ? '+' : '';
  return sign + formatMoney(amount, currency);
}

// ── Dates ─────────────────────────────────────────────────────────────────────

/**
 * Format a date for display.
 *
 * Examples:
 *   formatDate(new Date('2024-07-23')) → "Jul 23, 2024"
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * Format a date as a short date string for table cells.
 *
 * Examples:
 *   formatDateShort(new Date('2024-07-23')) → "07/23/2024"
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Format a relative time string.
 *
 * Examples:
 *   formatRelative(new Date(Date.now() - 60000)) → "1 minute ago"
 *   formatRelative(new Date(Date.now() + 86400000)) → "in 1 day"
 */
export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const seconds = Math.floor((d.getTime() - Date.now()) / 1000);

  if (Math.abs(seconds) < 60) return rtf.format(seconds, 'second');
  const minutes = Math.floor(seconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.floor(hours / 24);
  return rtf.format(days, 'day');
}

// ── Numbers ───────────────────────────────────────────────────────────────────

/**
 * Format a percentage.
 *
 * Examples:
 *   formatPercent(37.5)  → "37.5%"
 *   formatPercent(100)   → "100%"
 *   formatPercent(0.125) → "0.1%"
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a quantity with the appropriate decimal places.
 *
 * Examples:
 *   formatQuantity(50)     → "50"
 *   formatQuantity(1.5)    → "1.5"
 *   formatQuantity(1.500)  → "1.5" (trailing zeros removed)
 */
export function formatQuantity(quantity: number): string {
  return parseFloat(quantity.toFixed(3)).toString();
}
