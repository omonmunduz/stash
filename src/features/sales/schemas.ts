/**
 * SALE VALIDATION SCHEMAS
 */

import { z } from 'zod';
import { priceSchema } from '@/features/products/schemas';
import { paymentMethodSchema } from '@/features/payments/schemas';

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

/** One line as submitted by the sale form. */
export const createSaleItemSchema = z.object({
  product_id: z.string().uuid('Pick a product for every line'),
  quantity: quantitySchema,
  /**
   * Optional so the form can leave a line at the catalog price. The service
   * fills it in from the product rather than the form re-sending a price the
   * user never looked at.
   */
  unit_price: priceSchema.optional(),
  discount: moneySchema.optional(),
});

/**
 * Schema for creating a whole sale: header, lines, and the upfront payment.
 *
 * amount_paid is not bounded by the sale total. Someone settling an old debt
 * while buying more should be able to hand over one amount, and the surplus
 * lands on their older invoices or their account credit.
 */
export const createSaleWithItemsSchema = z.object({
  customer_id: z.string().uuid('Pick a customer'),
  items: z.array(createSaleItemSchema).min(1, 'Add at least one product to the sale'),
  sale_date: z.coerce.date().default(() => new Date()),
  due_date: z.coerce.date().nullable().optional(),
  notes: z.string().max(1000).trim().nullable().optional(),
  amount_paid: moneySchema.default(0),
  payment_method: paymentMethodSchema.default('cash'),
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

/**
 * Schema for adding or correcting one line on an existing sale.
 *
 * `item_id` present means edit that line, absent means add a new one. One schema
 * for both because the fields and their rules are identical — the only
 * difference is whether a row already exists, which the RPC decides.
 *
 * unit_price is required here, unlike on the create form. A blank price on a new
 * sale sensibly means "charge the catalog price"; a blank price while correcting
 * an existing line is ambiguous — it could mean "reprice to today's catalog"
 * when the user meant to leave the historical price alone. The edit form is
 * pre-filled with the current price, so there is no reason for it to arrive empty.
 */
export const upsertSaleItemSchema = z
  .object({
    item_id: z.string().uuid('Invalid line ID').optional(),
    product_id: z.string().uuid('Pick a product for this line'),
    quantity: quantitySchema,
    unit_price: priceSchema,
    discount: moneySchema.default(0),
  })
  .refine((data) => data.quantity * data.unit_price - data.discount >= 0, {
    message: 'The discount is more than the line is worth',
    path: ['discount'],
  });

export type UpsertSaleItemSchema = z.infer<typeof upsertSaleItemSchema>;

/**
 * Schema for updating sale-level fields only.
 *
 * tax and discount are absent for the reason given on UpdateSaleInput: they are
 * inputs to a total the triggers own.
 */
export const updateSaleSchema = z.object({
  sale_date: z.coerce.date().optional(),
  due_date: z.coerce.date().nullable().optional(),
  notes: z.string().max(1000).trim().nullable().optional(),
});

export type CreateSaleItemSchema = z.infer<typeof createSaleItemSchema>;
export type CreateSaleWithItemsSchema = z.infer<typeof createSaleWithItemsSchema>;
export type AddSaleItemSchema = z.infer<typeof addSaleItemSchema>;
export type UpdateSaleSchema = z.infer<typeof updateSaleSchema>;
