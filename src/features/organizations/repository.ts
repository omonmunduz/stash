/**
 * ORGANIZATION REPOSITORY INTERFACE
 *
 * Data access layer for organizations
 * Abstracts Supabase queries behind a clean interface
 */

import type {
  Organization,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  OrganizationFilter,
  OrganizationWithStats,
} from './types';
import type { OrganizationId } from '@/lib/types/common';

/**
 * Repository interface for organization data access
 *
 * Design decisions:
 * - All methods return Promise (async operations)
 * - findById returns null if not found (not throwing)
 * - Filter methods use typed filter objects
 * - Create/Update take validated input types
 */
export interface OrganizationRepository {
  /**
   * Find organization by ID
   * Returns null if not found or soft-deleted
   */
  findById(id: OrganizationId): Promise<Organization | null>;

  /**
   * Find organization by slug
   * Used for subdomain routing
   */
  findBySlug(slug: string): Promise<Organization | null>;

  /**
   * List all organizations (admin only)
   * Supports filtering and pagination
   */
  findAll(filter?: OrganizationFilter): Promise<Organization[]>;

  /**
   * Get organization with statistics
   * Includes counts of users, customers, products
   */
  findByIdWithStats(id: OrganizationId): Promise<OrganizationWithStats | null>;

  /**
   * Create a new organization
   * Returns the created organization with generated ID
   */
  create(input: CreateOrganizationInput): Promise<Organization>;

  /**
   * Update an existing organization
   * Returns the updated organization
   * Throws if organization not found
   */
  update(id: OrganizationId, input: UpdateOrganizationInput): Promise<Organization>;

  /**
   * Soft delete an organization
   * Sets deleted_at timestamp
   * Does NOT cascade delete related data (handled by database)
   */
  delete(id: OrganizationId): Promise<void>;

  /**
   * Check if slug is available
   * Returns true if slug is not used by any other organization
   */
  isSlugAvailable(slug: string, excludeId?: OrganizationId): Promise<boolean>;

  /**
   * Update subscription status (Phase 2)
   * Called by Stripe webhook handlers
   */
  updateSubscription(
    id: OrganizationId,
    update: {
      subscription_tier?: Organization['subscription_tier'];
      subscription_status?: Organization['subscription_status'];
      stripe_customer_id?: string;
      stripe_subscription_id?: string;
    }
  ): Promise<Organization>;

  /**
   * Find organizations with trials ending soon
   * Used for sending reminder emails (Phase 2)
   */
  findTrialsEndingSoon(days: number): Promise<Organization[]>;
}

/**
 * Example implementation outline (to be implemented with Supabase):
 *
 * export class SupabaseOrganizationRepository implements OrganizationRepository {
 *   constructor(private supabase: SupabaseClient) {}
 *
 *   async findById(id: OrganizationId): Promise<Organization | null> {
 *     const { data, error } = await this.supabase
 *       .from('organizations')
 *       .select('*')
 *       .eq('id', id)
 *       .is('deleted_at', null)
 *       .single();
 *
 *     if (error) return null;
 *     return this.mapToOrganization(data);
 *   }
 *
 *   // ... other methods
 * }
 */
