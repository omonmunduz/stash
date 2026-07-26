/**
 * ORGANIZATION VALIDATION SCHEMAS
 *
 * Zod schemas for runtime validation of organization data
 */

import { z } from 'zod';

/**
 * Subscription tier enum schema
 */
export const subscriptionTierSchema = z.enum(['trial', 'free', 'basic', 'pro', 'enterprise']);

/**
 * Subscription status enum schema
 */
export const subscriptionStatusSchema = z.enum(['trialing', 'active', 'past_due', 'cancelled', 'paused']);

/**
 * Organization settings schema
 * All fields optional with sensible defaults
 */
export const organizationSettingsSchema = z.object({
  currency: z.string().length(3).optional(), // ISO 4217 currency code
  tax_rate: z.number().min(0).max(100).optional(),
  date_format: z.string().optional(),
  number_format: z.string().optional(),
  timezone: z.string().optional(),
  features: z.object({
    multi_warehouse: z.boolean().optional(),
    barcode_scanning: z.boolean().optional(),
    advanced_reports: z.boolean().optional(),
  }).optional(),
  limits: z.object({
    max_users: z.number().int().positive().optional(),
    max_products: z.number().int().positive().optional(),
    max_customers: z.number().int().positive().optional(),
  }).optional(),
}).optional();

/**
 * Slug validation
 * - 3-63 characters
 * - lowercase letters, numbers, hyphens only
 * - must start and end with letter or number
 * - no consecutive hyphens
 */
export const slugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(63, 'Slug must be at most 63 characters')
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Invalid slug format')
  .refine(
    (slug) => !slug.startsWith('-') && !slug.endsWith('-'),
    'Slug cannot start or end with hyphen'
  );

/**
 * Schema for creating an organization
 */
export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: slugSchema.optional(),
  settings: organizationSettingsSchema,
});

/**
 * Schema for updating an organization
 */
export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: slugSchema.optional(),
  settings: organizationSettingsSchema,
  subscription_tier: subscriptionTierSchema.optional(),
  subscription_status: subscriptionStatusSchema.optional(),
});

/**
 * Type inference from schemas
 */
export type CreateOrganizationSchema = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationSchema = z.infer<typeof updateOrganizationSchema>;
