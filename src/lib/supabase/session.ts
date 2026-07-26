/**
 * SERVER SESSION HELPERS
 *
 * Utilities for accessing the current user session in Server Components,
 * Server Actions, and API routes.
 *
 * Design decisions:
 * - All functions are async (they query Supabase)
 * - Caching is handled by React Server Components automatically
 * - Use requireServerUser() when user MUST be authenticated
 * - Use getServerUser() when user might not be (returns null)
 */

import { createClient } from '@/lib/supabase/server';
import { getAuthState } from '@/features/auth/session';
import type { AuthUser } from '@/features/auth/types';
import type { OrganizationId, UserId } from '@/lib/types/common';

/**
 * Get the currently authenticated user with organization context.
 * Returns null if not authenticated, not onboarded, or deactivated.
 *
 * Delegates to getAuthState() rather than running its own query, so the profile
 * select and the is_active rule live in exactly one place. Prefer the guards in
 * @/features/auth/guards for pages — they redirect appropriately instead of
 * handing back a null the caller has to interpret.
 *
 * Use in Server Components and Server Actions:
 *   const user = await getServerUser()
 *   if (!user) redirect('/login')
 */
export async function getServerUser(): Promise<AuthUser | null> {
  const state = await getAuthState();
  return state.status === 'authenticated' ? state.user : null;
}

/**
 * Get the current user or throw an error.
 * Use when the user MUST be authenticated (e.g., in a Server Action).
 *
 * Throws and returns an error response if no user.
 */
export async function requireServerUser(): Promise<AuthUser> {
  const user = await getServerUser();
  if (!user) {
    throw new Error('Unauthorized: No authenticated user');
  }
  return user;
}

/**
 * Get the current user's organization ID from the session.
 * Returns null if not authenticated or no organization.
 *
 * Useful when you only need the org ID, not the full user object.
 */
export async function getServerOrgId(): Promise<OrganizationId | null> {
  const user = await getServerUser();
  return user?.organizationId ?? null;
}

/**
 * Get the current user's ID (even if they haven't completed onboarding).
 * Returns null if not authenticated.
 */
export async function getServerUserId(): Promise<UserId | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? (user.id as UserId) : null;
}

/**
 * Check if the current user is authenticated.
 * Lightweight check — doesn't query profile or organization.
 */
export async function isAuthenticated(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}
