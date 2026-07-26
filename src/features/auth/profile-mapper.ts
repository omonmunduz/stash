/**
 * Shared query shape + row→AuthState mapping for both the server and client
 * auth paths.
 *
 * Two places resolve auth state: session.ts (Server Components, via the SSR
 * client) and AuthProvider (browser, on token refresh or cross-tab events).
 * They cannot share a Supabase client, but they must agree on the select list
 * and the rules — otherwise a deactivated user is blocked on one side and
 * allowed on the other. Hence: clients differ, this logic does not.
 *
 * No 'use client' / 'use server' directive: pure, importable from both.
 */

import type { AuthState, AuthUser } from './types';
import type { OrganizationId, UserId } from '@/lib/types/common';

/**
 * Select list for the profile + organization join.
 *
 * Explicit columns rather than '*' so adding a column to user_profiles (say, a
 * hashed token) doesn't silently start shipping it to the browser.
 */
export const PROFILE_SELECT =
  'id, full_name, role, organization_id, is_active, organization:organizations(id, name, slug)';

/**
 * The row shape PROFILE_SELECT returns.
 *
 * Hand-written because src/lib/database.types.ts is maintained manually and
 * doesn't model embedded joins; without an explicit type, Supabase's inference
 * collapses the result to `never`. Keep in sync with PROFILE_SELECT above.
 */
export interface ProfileWithOrganization {
  id: string;
  full_name: string | null;
  role: AuthUser['role'];
  organization_id: string;
  is_active: boolean;
  organization: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

/**
 * Maps a profile row to an AuthState.
 *
 * @param row    The profile row, or null when no row exists.
 * @param userId The authenticated user's id, from auth.users.
 * @param email  From the auth user — user_profiles doesn't store it, auth.users owns it.
 *
 * @throws If the profile references an organization that doesn't exist. That's
 * a broken invariant (org deleted, profile orphaned), not a state to render.
 */
export function mapProfileToAuthState(
  row: ProfileWithOrganization | null,
  userId: string,
  email: string
): AuthState {
  // No profile row: registered, but organization creation hasn't run or was
  // rolled back. Normal immediately after sign-up.
  if (!row) {
    return { status: 'authenticated_no_org', userId, email };
  }

  if (!row.is_active) {
    return { status: 'deactivated' };
  }

  if (!row.organization) {
    throw new Error(
      `User profile ${row.id} references missing organization ${row.organization_id}`
    );
  }

  return {
    status: 'authenticated',
    user: {
      id: row.id as UserId,
      email,
      // full_name is nullable; fall back to the email local part so the UI
      // never renders "null" in a greeting.
      fullName: row.full_name?.trim() || email.split('@')[0] || 'User',
      role: row.role,
      organizationId: row.organization_id as OrganizationId,
      organization: {
        id: row.organization.id as OrganizationId,
        name: row.organization.name,
        slug: row.organization.slug,
      },
    },
  };
}
