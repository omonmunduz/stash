/**
 * ORGANIZATION DOMAIN MODEL
 *
 * Organizations represent separate businesses using the platform (multi-tenant).
 * Each organization has its own subscription, settings, and isolated data.
 */

import type { OrganizationId, Timestamps } from '@/lib/types/common';

/**
 * Subscription tiers with increasing features/limits
 */
export type SubscriptionTier = 'trial' | 'free' | 'basic' | 'pro' | 'enterprise';

/**
 * Subscription status for billing
 */
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused';

/**
 * Organization settings (stored as JSONB, flexible structure)
 */
export interface OrganizationSettings {
  currency?: string;
  tax_rate?: number;
  date_format?: string;
  number_format?: string;
  timezone?: string;
  features?: {
    multi_warehouse?: boolean;
    barcode_scanning?: boolean;
    advanced_reports?: boolean;
  };
  limits?: {
    max_users?: number;
    max_products?: number;
    max_customers?: number;
  };
}

/**
 * Complete Organization entity
 *
 * Design decisions:
 * - slug is URL-friendly identifier for subdomain routing
 * - subscription fields present but not enforced in MVP
 * - settings as JSONB allows flexible config without migrations
 * - Stripe IDs nullable until Phase 2
 */
export interface Organization extends Timestamps {
  id: OrganizationId;
  name: string;
  slug: string;

  // Subscription fields (Phase 2)
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  trial_ends_at: Date;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;

  // Flexible settings
  settings: OrganizationSettings;
}

/**
 * Input for creating a new organization
 *
 * Design decisions:
 * - Only require essential fields (name)
 * - Auto-generate slug from name (can be customized)
 * - Default to trial tier with 30-day trial
 * - Settings optional with sensible defaults
 */
export interface CreateOrganizationInput {
  name: string;
  slug?: string; // Auto-generated if not provided
  settings?: Partial<OrganizationSettings>;
}

/**
 * Input for updating an organization
 * All fields optional (partial update)
 */
export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  settings?: Partial<OrganizationSettings>;

  // Phase 2: Allow updating subscription
  subscription_tier?: SubscriptionTier;
  subscription_status?: SubscriptionStatus;
}

/**
 * Filter for querying organizations
 * (Mainly for admin/system views, users only see their own org)
 */
export interface OrganizationFilter {
  subscription_tier?: SubscriptionTier;
  subscription_status?: SubscriptionStatus;
  trial_ending_soon?: boolean; // Trial ends within 7 days
}

/**
 * Organization with computed fields
 */
export interface OrganizationWithStats extends Organization {
  user_count: number;
  customer_count: number;
  product_count: number;
  is_trial_expired: boolean;
  days_until_trial_end: number;
}
