/**
 * USER VALIDATION SCHEMAS
 */

import { z } from 'zod';

/**
 * User role enum schema
 */
export const userRoleSchema = z.enum(['owner', 'admin', 'manager', 'employee']);

/**
 * Email validation
 * - Valid email format
 * - Reasonable length limits
 */
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .min(5, 'Email too short')
  .max(255, 'Email too long')
  .toLowerCase()
  .trim();

/**
 * Phone validation
 * - Optional
 * - International format accepted
 * - Basic format check
 */
export const phoneSchema = z
  .string()
  .regex(/^[\d\s\-\+\(\)]+$/, 'Invalid phone number format')
  .min(7, 'Phone number too short')
  .max(20, 'Phone number too long')
  .optional()
  .nullable();

/**
 * Full name validation
 * - At least 2 characters
 * - Max 100 characters
 * - Only letters, spaces, hyphens, apostrophes
 */
export const fullNameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be at most 100 characters')
  .regex(/^[a-zA-Z\s\-']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .trim();

/**
 * Schema for creating a user
 */
export const createUserSchema = z.object({
  organization_id: z.string().uuid(),
  email: emailSchema,
  full_name: fullNameSchema,
  phone: phoneSchema,
  role: userRoleSchema.default('employee'),
});

/**
 * Schema for updating a user
 */
export const updateUserSchema = z.object({
  full_name: fullNameSchema.optional(),
  phone: phoneSchema,
  role: userRoleSchema.optional(),
  is_active: z.boolean().optional(),
});

/**
 * Schema for user invitation
 */
export const inviteUserSchema = z.object({
  email: emailSchema,
  role: userRoleSchema.default('employee'),
});

/**
 * Type inference from schemas
 */
export type CreateUserSchema = z.infer<typeof createUserSchema>;
export type UpdateUserSchema = z.infer<typeof updateUserSchema>;
export type InviteUserSchema = z.infer<typeof inviteUserSchema>;
