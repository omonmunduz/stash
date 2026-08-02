/**
 * PAYMENT VALIDATION SCHEMAS
 */

import { z } from 'zod';

export const paymentMethodSchema = z.enum([
  'cash',
  'card',
  'bank_transfer',
  'check',
  'other',
]);

/**
 * Schema for recording a new payment.
 * amount must be positive — a reversal/void is a separate operation (soft delete).
 */
export const createPaymentSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  sale_id: z.string().uuid('Invalid sale ID').optional(),
  payment_date: z.coerce.date().default(() => new Date()),
  amount: z
    .number()
    .positive('Payment amount must be greater than zero')
    .refine(
      (val) => Number(val.toFixed(2)) === val || Number.isInteger(val * 100),
      'Amount can have at most 2 decimal places'
    ),
  payment_method: paymentMethodSchema,
  reference_number: z.string().max(100).trim().optional(),
  notes: z.string().max(500).trim().optional(),
});

/**
 * Schema for correcting a payment record.
 *
 * `amount` is editable. Recording 50 when the customer handed over 30 is the
 * single most likely data-entry mistake in a cash business, and voiding a receipt
 * the customer is holding is a worse answer than correcting the figure. The
 * service routes an amount change through update_payment_amount, which re-runs
 * oldest-debt-first allocation so no invoice is left claiming money that no
 * longer exists.
 */
export const updatePaymentSchema = z.object({
  amount: z
    .number()
    .positive('Payment amount must be greater than zero')
    .refine(
      (val) => Number(val.toFixed(2)) === val || Number.isInteger(val * 100),
      'Amount can have at most 2 decimal places'
    )
    .optional(),
  payment_date: z.coerce.date().optional(),
  payment_method: paymentMethodSchema.optional(),
  reference_number: z.string().max(100).trim().nullable().optional(),
  notes: z.string().max(500).trim().nullable().optional(),
});

export type CreatePaymentSchema = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentSchema = z.infer<typeof updatePaymentSchema>;
