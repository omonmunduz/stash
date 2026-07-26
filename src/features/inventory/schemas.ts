/**
 * INVENTORY VALIDATION SCHEMAS
 */

import { z } from 'zod';

export const inventoryAdjustmentReasonSchema = z.enum([
  'initial_stock',
  'purchase',
  'return',
  'damage',
  'loss',
  'count_correction',
  'other',
]);

/**
 * Schema for setting absolute inventory quantity (e.g. after physical count).
 */
export const setInventorySchema = z.object({
  product_id: z.string().uuid(),
  quantity_on_hand: z
    .number()
    .min(0, 'Quantity cannot be negative')
    .refine(
      (val) => Number(val.toFixed(3)) === val || Number.isInteger(val * 1000),
      'Quantity can have at most 3 decimal places'
    ),
  reason: inventoryAdjustmentReasonSchema.default('count_correction'),
  notes: z.string().max(500).optional(),
});

/**
 * Schema for adjusting inventory by a delta (positive or negative).
 */
export const adjustInventorySchema = z.object({
  product_id: z.string().uuid(),
  quantity_delta: z
    .number()
    .refine((val) => val !== 0, 'Adjustment quantity cannot be zero')
    .refine(
      (val) => Number(Math.abs(val).toFixed(3)) === Math.abs(val),
      'Quantity can have at most 3 decimal places'
    ),
  reason: inventoryAdjustmentReasonSchema,
  notes: z.string().max(500).optional(),
});

export type SetInventorySchema = z.infer<typeof setInventorySchema>;
export type AdjustInventorySchema = z.infer<typeof adjustInventorySchema>;
