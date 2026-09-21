/**
 * LOCALE-AWARE FORMATTING HELPERS
 *
 * These wrap the core format utilities with locale awareness for use in
 * client components. Server components should use the format utils directly
 * with the locale from getLocale().
 */

import { formatDate as formatDateCore, formatMoney as formatMoneyCore } from '@/lib/utils/format';

/**
 * Format a date with the current locale.
 * For client components only - use formatDate directly in server components.
 */
export function useFormatDate(locale: string) {
  return (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  };
}

/**
 * Format money with the current locale.
 * For client components only - use formatMoney directly in server components.
 */
export function useFormatMoney(locale: string) {
  return (amount: number, currency?: string): string => {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    return currency ? `${formatted} ${currency}` : formatted;
  };
}
