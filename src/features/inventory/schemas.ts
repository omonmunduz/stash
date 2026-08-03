/**
 * INVENTORY VALIDATION SCHEMAS
 *
 * Two things get validated here, and they are deliberately different shapes.
 *
 * The item catalogue mirrors products/schemas.ts — same code, name, and price
 * rules, minus sale_price, because an item is never sold.
 *
 * Stock operations are keyed on an InventorySubjectRef: a discriminated union on
 * `kind`, not a bare product_id. The old version of this file took
 * `product_id: z.string().uuid()`, which made it impossible to adjust an item's
 * stock at all — the union is what lets one form serve both.
 */

import { z } from 'zod';

/**
 * Quantities are DECIMAL(15,3) in the database, so three places is the limit.
 *
 * A builder rather than a constant because `.min()` only exists on ZodNumber, and
 * `.refine()` returns a ZodEffects that no longer has it — so the bound has to be
 * applied before the decimal check, not after. Callers that allow negatives (a
 * stock delta) omit the bound entirely.
 */
function quantitySchema(bound?: { min: number; message: string }) {
  const base = z.number().finite('Enter a number.');

  return (bound ? base.min(bound.min, bound.message) : base).refine(
    (value) => Number(value.toFixed(3)) === value,
    'Quantity can have at most 3 decimal places'
  );
}

/** Non-negative money, up to 2 decimal places. Zero is allowed — free samples exist. */
const priceSchema = z
  .number()
  .min(0, 'Price cannot be negative')
  .refine(
    (value) => Number(value.toFixed(2)) === value,
    'Price can have at most 2 decimal places'
  );

/**
 * Item code: same rule as a product SKU, so the two catalogues stay searchable
 * the same way.
 */
export const itemCodeSchema = z
  .string()
  .min(1, 'Item code is required')
  .max(50, 'Item code must be at most 50 characters')
  .regex(
    /^[A-Za-z0-9\-_]+$/,
    'Item code can only contain letters, numbers, hyphens, and underscores'
  )
  .toUpperCase()
  .trim();

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
 * Which product or item a stock operation is about.
 *
 * A discriminated union so the parsed result narrows the same way
 * InventorySubjectRef does, rather than arriving as two optional ids that every
 * caller has to re-check.
 */
export const inventorySubjectRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('product'), id: z.string().uuid('Choose a product.') }),
  z.object({ kind: z.literal('item'), id: z.string().uuid('Choose an item.') }),
]);

/** Schema for creating a non-sellable item. */
export const createInventoryItemSchema = z.object({
  item_code: itemCodeSchema.optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  description: z.string().max(500).trim().optional(),
  category: z.string().max(50).trim().optional(),
  unit_of_measure: z.string().max(20).trim().default('unit'),
  cost_price: priceSchema,
  reorder_level: quantitySchema({ min: 0, message: 'Reorder level cannot be negative' })
    .nullable()
    .optional(),
  image_url: z.string().max(500).nullable().optional(),
  initial_quantity: quantitySchema({
    min: 0,
    message: 'Opening stock cannot be negative',
  }).optional(),
});

/** Schema for updating a non-sellable item. Stock is not editable here. */
export const updateInventoryItemSchema = z.object({
  item_code: itemCodeSchema.optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim().optional(),
  description: z.string().max(500).trim().nullable().optional(),
  category: z.string().max(50).trim().nullable().optional(),
  unit_of_measure: z.string().max(20).trim().optional(),
  cost_price: priceSchema.optional(),
  reorder_level: quantitySchema({ min: 0, message: 'Reorder level cannot be negative' })
    .nullable()
    .optional(),
  image_url: z.string().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
});

/**
 * Schema for a signed stock adjustment.
 *
 * The note is required when the reason is 'other', because "other" with no
 * explanation is the one combination that tells a later reader nothing — which
 * is the whole point of the log.
 */
export const adjustStockSchema = z
  .object({
    ref: inventorySubjectRefSchema,
    // No lower bound: a delta is signed, and stock leaving is the negative case.
    delta: quantitySchema().refine(
      (value) => value !== 0,
      'Enter how much stock came in or went out.'
    ),
    reason: inventoryAdjustmentReasonSchema,
    notes: z.string().max(500).trim().optional(),
  })
  .refine((data) => data.reason !== 'other' || Boolean(data.notes), {
    message: 'Please explain why this adjustment was made.',
    path: ['notes'],
  });

/**
 * Schema for correcting stock to a counted figure.
 *
 * An absolute number rather than a delta: that is what a physical count
 * produces. The delta is derived inside the database under the row lock.
 */
export const setCountSchema = z.object({
  ref: inventorySubjectRefSchema,
  counted: quantitySchema({
    min: 0,
    message: 'A counted quantity cannot be negative',
  }),
  notes: z.string().max(500).trim().optional(),
});

export type CreateInventoryItemSchema = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemSchema = z.infer<typeof updateInventoryItemSchema>;
export type AdjustStockSchema = z.infer<typeof adjustStockSchema>;
export type SetCountSchema = z.infer<typeof setCountSchema>;
