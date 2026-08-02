/**
 * PAYMENT DISPLAY LABELS
 *
 * The enum values are snake_case database identifiers; these are what a person
 * reads. Kept in one module because three components render them — the history
 * table, the record form's method select, and the edit form — and a method
 * spelled "Bank transfer" in one place and "Transfer" in another looks like two
 * different things.
 *
 * Declared as a full Record so adding a payment method to the enum fails the
 * build here rather than rendering a raw `bank_transfer` in the UI.
 */

import type { PaymentMethod } from './types';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  check: 'Check',
  other: 'Other',
};
