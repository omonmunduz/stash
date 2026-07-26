/**
 * USER DOMAIN MODEL
 *
 * Users are people who work for an organization.
 * Extends Supabase auth.users with business context (role, organization).
 *
 * Design decisions:
 * - User authentication handled by Supabase Auth
 * - user_profiles table adds business context
 * - Role-based access control (RBAC) with 4 roles
 * - Each user belongs to exactly one organization
 */

import type { UserId, OrganizationId, Timestamps } from '@/lib/types/common';

/**
 * User role hierarchy
 * owner > admin > manager > employee
 */
export type UserRole = 'owner' | 'admin' | 'manager' | 'employee';

/**
 * Complete User entity (user_profiles table)
 *
 * Design decisions:
 * - id matches auth.users.id (same UUID)
 * - email stored here for easy access (also in auth.users)
 * - phone optional (not all users need it)
 * - is_active allows disabling users without deleting
 */
export interface User extends Timestamps {
  id: UserId;
  organization_id: OrganizationId;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
}

/**
 * Input for creating a new user
 *
 * Design decisions:
 * - Requires invitation flow (user doesn't set own password initially)
 * - Email must be unique across entire platform (Supabase constraint)
 * - Role defaults to 'employee' (least privilege)
 */
export interface CreateUserInput {
  organization_id: OrganizationId;
  email: string;
  full_name: string;
  phone?: string;
  role?: UserRole;
}

/**
 * Input for updating a user
 * All fields optional except those that shouldn't change
 */
export interface UpdateUserInput {
  full_name?: string;
  phone?: string | null;
  role?: UserRole;
  is_active?: boolean;
}

/**
 * Filter for querying users
 */
export interface UserFilter {
  organization_id: OrganizationId;
  role?: UserRole;
  is_active?: boolean;
  search?: string; // Search in name or email
}

/**
 * User with organization details
 */
export interface UserWithOrganization extends User {
  organization: {
    id: OrganizationId;
    name: string;
    slug: string;
  };
}

/**
 * User profile for display (non-sensitive fields)
 */
export interface UserProfile {
  id: UserId;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}

/**
 * Current authenticated user context
 * Includes organization and permissions
 */
export interface AuthUser extends User {
  organization: {
    id: OrganizationId;
    name: string;
    slug: string;
    subscription_tier: string;
  };
}

/**
 * User invitation data
 * Stores pending invitations before user accepts
 */
export interface UserInvitation {
  id: string;
  organization_id: OrganizationId;
  email: string;
  role: UserRole;
  invited_by: UserId;
  expires_at: Date;
  accepted_at: Date | null;
  created_at: Date;
}
