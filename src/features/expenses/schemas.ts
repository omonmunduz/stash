/**
 * EXPENSE VALIDATION SCHEMAS
 */

import { z } from 'zod';
import { paymentMethodSchema } from '@/features/payments/schemas';

/**
 * Schema for recording a new expense.
 * category is free text — no predefined list.
 */
export const createExpenseSchema = z.object({
  expense_date: z.coerce.date().default(() => new Date()),
  category: z
    .string()
    .min(2, 'Category must be at least 2 characters')
    .max(50, 'Category must be at most 50 characters')
    .trim(),
  vendor: z.string().max(100).trim().optional(),
  amount: z
    .number()
    .positive('Amount must be greater than zero')
    .refine(
      (val) => Number(val.toFixed(2)) === val || Number.isInteger(val * 100),
      'Amount can have at most 2 decimal places'
    ),
  payment_method: paymentMethodSchema,
  description: z
    .string()
    .min(3, 'Description must be at least 3 characters')
    .max(500)
    .trim(),
  receipt_url: z.string().url('Invalid receipt URL').optional(),
});

/** Schema for updating an expense */
export const updateExpenseSchema = z.object({
  expense_date: z.coerce.date().optional(),
  category: z.string().min(2).max(50).trim().optional(),
  vendor: z.string().max(100).trim().nullable().optional(),
  amount: z.number().positive().optional(),
  payment_method: paymentMethodSchema.optional(),
  description: z.string().min(3).max(500).trim().optional(),
  receipt_url: z.string().url().nullable().optional(),
});

export type CreateExpenseSchema = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseSchema = z.infer<typeof updateExpenseSchema>;
