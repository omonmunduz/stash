/**
 * PAYMENT METHOD TRANSLATION HELPERS
 *
 * Shared helpers for translating payment methods consistently across the app.
 * System-defined payment methods are translated; user-defined values pass through.
 */

import type { PaymentMethod } from './types';

/**
 * System-defined payment methods that have translation keys.
 */
export const SYSTEM_PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash',
  'card',
  'bank_transfer',
  'check',
  'other',
] as const;

/**
 * Get translated label for a payment method.
 * System methods use translation keys, unknown values pass through unchanged.
 *
 * @param method - The payment method value from the database
 * @param t - Translation function for 'payments.filters' namespace
 * @returns Translated label or original value
 */
export function getPaymentMethodLabel(
  method: PaymentMethod,
  t: (key: string) => string
): string {
  if (SYSTEM_PAYMENT_METHODS.includes(method)) {
    return t(`method.${method}`);
  }
  // User-defined value - return as-is
  return method;
}
