/**
 * ORGANIZATION BUSINESS RULES
 *
 * Domain logic for organization management
 */

import type { Organization, SubscriptionTier, OrganizationSettings } from './types';
import type { Result } from '@/lib/types/common';

/**
 * Generate a URL-friendly slug from organization name
 *
 * Rules:
 * - Convert to lowercase
 * - Replace spaces and special chars with hyphens
 * - Remove consecutive hyphens
 * - Remove leading/trailing hyphens
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .replace(/-+/g, '-') // Replace consecutive hyphens with single
    .slice(0, 63); // Max length for domain labels
}

/**
 * Check if organization's trial has expired
 */
export function isTrialExpired(org: Organization): boolean {
  if (org.subscription_tier !== 'trial') {
    return false;
  }
  return new Date() > org.trial_ends_at;
}

/**
 * Calculate days until trial ends
 * Returns negative number if already expired
 */
export function daysUntilTrialEnd(org: Organization): number {
  if (org.subscription_tier !== 'trial') {
    return 0;
  }
  const now = new Date();
  const diff = org.trial_ends_at.getTime() - now.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Check if organization can add more users based on subscription limits
 *
 * MVP: Always returns true (no enforcement)
 * Phase 2: Check against subscription tier limits
 */
export function canAddUser(org: Organization, currentUserCount: number): Result<void> {
  // MVP: No limits enforced
  if (org.subscription_tier === 'trial') {
    return { success: true, data: undefined };
  }

  // Phase 2: Check limits
  const maxUsers = org.settings.limits?.max_users;
  if (maxUsers && currentUserCount >= maxUsers) {
    return {
      success: false,
      error: `User limit reached (${maxUsers}). Upgrade your plan to add more users.`,
    };
  }

  return { success: true, data: undefined };
}

/**
 * Check if organization can add more products
 *
 * MVP: Always returns true
 * Phase 2: Check against subscription tier limits
 */
export function canAddProduct(org: Organization, currentProductCount: number): Result<void> {
  // MVP: No limits enforced
  if (org.subscription_tier === 'trial') {
    return { success: true, data: undefined };
  }

  const maxProducts = org.settings.limits?.max_products;
  if (maxProducts && currentProductCount >= maxProducts) {
    return {
      success: false,
      error: `Product limit reached (${maxProducts}). Upgrade your plan to add more products.`,
    };
  }

  return { success: true, data: undefined };
}

/**
 * Check if feature is enabled for organization
 *
 * MVP: All features enabled for trial
 * Phase 2: Check feature flags based on subscription tier
 */
export function hasFeature(
  org: Organization,
  feature: keyof NonNullable<OrganizationSettings['features']>
): boolean {
  // MVP: All features enabled during trial
  if (org.subscription_tier === 'trial') {
    return true;
  }

  // Check explicit feature flag
  return org.settings.features?.[feature] ?? false;
}

/**
 * Get default settings for a new organization
 */
export function getDefaultSettings(): OrganizationSettings {
  return {
    currency: 'KGS',
    tax_rate: 0,
    date_format: 'YYYY-MM-DD',
    number_format: 'en-US',
    timezone: 'Asia/Bishkek',
    features: {
      multi_warehouse: false,
      barcode_scanning: false,
      advanced_reports: false,
    },
    limits: {
      max_users: undefined, // Unlimited during trial
      max_products: undefined,
      max_customers: undefined,
    },
  };
}

/**
 * Merge partial settings with existing settings
 * Deep merge to preserve nested values
 */
export function mergeSettings(
  existing: OrganizationSettings,
  updates: Partial<OrganizationSettings>
): OrganizationSettings {
  return {
    ...existing,
    ...updates,
    features: {
      ...existing.features,
      ...updates.features,
    },
    limits: {
      ...existing.limits,
      ...updates.limits,
    },
  };
}

/**
 * Validate that slug is available (not used by another org)
 * This should be called by the repository before creating/updating
 */
export function validateSlugAvailable(
  slug: string,
  existingOrg: Organization | null
): Result<void> {
  if (existingOrg) {
    return {
      success: false,
      error: `Slug "${slug}" is already taken. Please choose another.`,
    };
  }
  return { success: true, data: undefined };
}
