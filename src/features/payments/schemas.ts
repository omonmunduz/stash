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
 * `amount` is absent on purpose. Changing it after the fact would leave the
 * allocations describing a split of money that no longer exists — the trigger
 * would re-derive the invoices, but the extra would sit unallocated with no
 * record of why. Void the payment and record the right one instead.
 */
export const updatePaymentSchema = z.object({
  payment_date: z.coerce.date().optional(),
  payment_method: paymentMethodSchema.optional(),
  reference_number: z.string().max(100).trim().nullable().optional(),
  notes: z.string().max(500).trim().nullable().optional(),
});

export type CreatePaymentSchema = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentSchema = z.infer<typeof updatePaymentSchema>;
