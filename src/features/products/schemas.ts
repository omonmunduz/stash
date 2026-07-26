/**
 * PRODUCT VALIDATION SCHEMAS
 */

import { z } from 'zod';

/**
 * SKU: alphanumeric, hyphens, underscores. Max 50 chars.
 * We do not enforce a specific format — every business uses its own convention.
 */
export const skuSchema = z
  .string()
  .min(1, 'SKU is required')
  .max(50, 'SKU must be at most 50 characters')
  .regex(/^[A-Za-z0-9\-_]+$/, 'SKU can only contain letters, numbers, hyphens, and underscores')
  .toUpperCase()
  .trim();

/**
 * Price: must be a non-negative number with up to 2 decimal places.
 * Zero is allowed for cost_price (free samples, promotional items).
 */
export const priceSchema = z
  .number()
  .min(0, 'Price cannot be negative')
  .refine(
    (val) => Number(val.toFixed(2)) === val || Number.isInteger(val * 100),
    'Price can have at most 2 decimal places'
  );

/** Schema for creating a product */
export const createProductSchema = z
  .object({
    sku: skuSchema.optional(),
    name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
    description: z.string().max(500).trim().optional(),
    category: z.string().max(50).trim().optional(),
    unit_of_measure: z.string().max(20).trim().default('unit'),
    cost_price: priceSchema,
    sale_price: priceSchema,
    barcode: z.string().max(50).trim().optional(),
    reorder_level: z.number().int().min(0).optional(),
    initial_quantity: z.number().min(0).default(0),
  })
  .refine(
    (data) => data.sale_price >= data.cost_price,
    {
      message: 'Selling price should be greater than or equal to cost price',
      path: ['sale_price'],
    }
  );

/** Schema for updating a product */
export const updateProductSchema = z
  .object({
    sku: skuSchema.optional(),
    name: z.string().min(2).max(100).trim().optional(),
    description: z.string().max(500).trim().nullable().optional(),
    category: z.string().max(50).trim().nullable().optional(),
    unit_of_measure: z.string().max(20).trim().optional(),
    cost_price: priceSchema.optional(),
    sale_price: priceSchema.optional(),
    barcode: z.string().max(50).trim().nullable().optional(),
    reorder_level: z.number().int().min(0).nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.sale_price !== undefined && data.cost_price !== undefined) {
        return data.sale_price >= data.cost_price;
      }
      return true;
    },
    {
      message: 'Selling price should be greater than or equal to cost price',
      path: ['sale_price'],
    }
  );

export type CreateProductSchema = z.infer<typeof createProductSchema>;
export type UpdateProductSchema = z.infer<typeof updateProductSchema>;
