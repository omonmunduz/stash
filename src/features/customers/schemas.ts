/**
 * CUSTOMER VALIDATION SCHEMAS
 */

import { z } from 'zod';

/**
 * Customer code format: CUST-NNNN
 * The number portion can be any length but typically 4 digits.
 */
export const customerCodeSchema = z
  .string()
  .regex(/^CUST-\d{1,8}$/, 'Customer code must be in format CUST-0001');

/**
 * Credit limit: positive decimal or null (no limit).
 */
export const creditLimitSchema = z
  .number()
  .positive('Credit limit must be a positive number')
  .nullable()
  .optional();

/**
 * Phone: permissive format — every country uses different conventions.
 */
export const phoneSchema = z
  .string()
  .min(5, 'Phone number too short')
  .max(30, 'Phone number too long')
  .regex(/^[\d\s\-\+\(\)]+$/, 'Phone number contains invalid characters')
  .nullable()
  .optional();

/** Schema for creating a customer */
export const createCustomerSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim(),
  business_name: z.string().max(100).trim().optional(),
  email: z.string().email('Invalid email').max(255).toLowerCase().trim().optional(),
  phone: phoneSchema,
  address: z.string().max(255).trim().optional(),
  city: z.string().max(100).trim().optional(),
  credit_limit: creditLimitSchema,
  notes: z.string().max(1000).trim().optional(),
  customer_code: customerCodeSchema.optional(),
});

/** Schema for updating a customer — all fields optional */
export const updateCustomerSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  business_name: z.string().max(100).trim().nullable().optional(),
  email: z.string().email().max(255).toLowerCase().trim().nullable().optional(),
  phone: phoneSchema,
  address: z.string().max(255).trim().nullable().optional(),
  city: z.string().max(100).trim().nullable().optional(),
  credit_limit: creditLimitSchema,
  notes: z.string().max(1000).trim().nullable().optional(),
  is_active: z.boolean().optional(),
});

export type CreateCustomerSchema = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerSchema = z.infer<typeof updateCustomerSchema>;
