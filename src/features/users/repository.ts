/**
 * USER REPOSITORY INTERFACE
 *
 * Data access layer for user profiles.
 * Authentication itself is handled by Supabase Auth — this repository
 * only covers the user_profiles table.
 */

import type {
  User,
  UserProfile,
  UserFilter,
  UserInvitation,
  CreateUserInput,
  UpdateUserInput,
  UserRole,
} from './types';
import type { UserId, OrganizationId } from '@/lib/types/common';

export interface UserRepository {
  /**
   * Find a user profile by their Supabase auth ID
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * Find a user profile by email (within an organization)
   */
  findByEmail(email: string, organizationId: OrganizationId): Promise<User | null>;

  /**
   * List all users in an organization
   */
  findAll(filter: UserFilter): Promise<User[]>;

  /**
   * Get lightweight profile list for selects and mentions
   */
  findProfiles(organizationId: OrganizationId): Promise<UserProfile[]>;

  /**
   * Create a user profile after Supabase Auth has created the auth record.
   * The id must match the auth.users.id.
   */
  create(input: CreateUserInput & { id: UserId }): Promise<User>;

  /**
   * Update profile fields (not email, not auth password)
   */
  update(id: UserId, input: UpdateUserInput): Promise<User>;

  /**
   * Soft-delete a user profile
   * The Supabase auth.users record is handled separately by Supabase
   */
  delete(id: UserId): Promise<void>;

  /**
   * Count active users in an organization
   * Used to enforce subscription user limits
   */
  countActive(organizationId: OrganizationId): Promise<number>;

  /**
   * Count users with a specific role
   * Used to prevent deleting the last owner
   */
  countByRole(organizationId: OrganizationId, role: UserRole): Promise<number>;

  // ── Invitations ─────────────────────────────────────────────────────────

  /**
   * Create an invitation for a new user
   */
  createInvitation(invitation: Omit<UserInvitation, 'id' | 'created_at' | 'accepted_at'>): Promise<UserInvitation>;

  /**
   * Find a pending invitation by email
   */
  findInvitationByEmail(email: string, organizationId: OrganizationId): Promise<UserInvitation | null>;

  /**
   * Mark an invitation as accepted
   */
  acceptInvitation(invitationId: string): Promise<void>;

  /**
   * Delete expired invitations
   */
  deleteExpiredInvitations(): Promise<void>;
}
