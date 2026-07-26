/**
 * SALE VALIDATION SCHEMAS
 */

import { z } from 'zod';
import { priceSchema } from '@/features/products/schemas';

const moneySchema = z
  .number()
  .min(0, 'Amount cannot be negative')
  .refine(
    (val) => Number(val.toFixed(2)) === val || Number.isInteger(val * 100),
    'Amount can have at most 2 decimal places'
  );

const quantitySchema = z
  .number()
  .positive('Quantity must be greater than zero')
  .refine(
    (val) => Number(val.toFixed(3)) === val || Number.isInteger(val * 1000),
    'Quantity can have at most 3 decimal places'
  );

/** Schema for creating a new sale header */
export const createSaleSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  sale_date: z.coerce.date().default(() => new Date()),
  due_date: z.coerce.date().optional(),
  tax: moneySchema.default(0),
  discount: moneySchema.default(0),
  notes: z.string().max(1000).trim().optional(),
});

/** Schema for adding a line item to a sale */
export const addSaleItemSchema = z
  .object({
    product_id: z.string().uuid('Invalid product ID'),
    quantity: quantitySchema,
    unit_price: priceSchema.optional(),
    discount: moneySchema.default(0),
  })
  .refine(
    (data) => {
      if (data.unit_price !== undefined && data.discount !== undefined) {
        const subtotal = data.quantity * data.unit_price - data.discount;
        return subtotal >= 0;
      }
      return true;
    },
    {
      message: 'Line discount cannot exceed the line total',
      path: ['discount'],
    }
  );

/** Schema for updating sale-level fields only */
export const updateSaleSchema = z.object({
  sale_date: z.coerce.date().optional(),
  due_date: z.coerce.date().nullable().optional(),
  tax: moneySchema.optional(),
  discount: moneySchema.optional(),
  notes: z.string().max(1000).trim().nullable().optional(),
});

export type CreateSaleSchema = z.infer<typeof createSaleSchema>;
export type AddSaleItemSchema = z.infer<typeof addSaleItemSchema>;
export type UpdateSaleSchema = z.infer<typeof updateSaleSchema>;
