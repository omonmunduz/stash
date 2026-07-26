/**
 * AUTH GUARDS
 *
 * Server-side permission guards for protecting routes, Server Actions,
 * and API endpoints.
 *
 * Design decisions:
 * - Guards use the Result<T> pattern (no thrown exceptions) for soft checks
 * - Guards use assertion functions (throws) for hard requirements
 *   (a page crashing loudly is better than silently showing wrong data)
 * - Role checks use numeric hierarchy so "requires manager" also passes for owner/admin
 */

import { redirect } from 'next/navigation';
import type { AuthUser } from './types';
import type { UserRole } from '@/features/users/types';
import type { Result } from '@/lib/types/common';
import { ROUTES } from '@/lib/constants/routes';
import { getAuthState } from './session';

/** Numeric weight per role — higher number = more permissions */
const ROLE_LEVEL: Record<UserRole, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  employee: 1,
};

// ── Hard Guards (throw / redirect) ────────────────────────────────────────────

/**
 * Asserts the current user is authenticated.
 * Redirects to /login if not.
 * Use at the top of Server Components and Server Actions.
 */
export function requireAuth(user: AuthUser | null): asserts user is AuthUser {
  if (!user) {
    redirect(ROUTES.auth.login);
  }
}

/**
 * Asserts the current user has an organization.
 * Redirects to onboarding if they don't.
 * Use after requireAuth to confirm onboarding is complete.
 */
export function requireOrganization(user: AuthUser | null): asserts user is AuthUser {
  if (!user) {
    redirect(ROUTES.auth.login);
  }
  if (!user.organizationId) {
    redirect(ROUTES.onboarding.setup);
  }
}

// ── Soft Guards (return Result) ───────────────────────────────────────────────

/**
 * Checks whether the user has at least the specified role level.
 * Returns a Result so the caller can decide how to handle failures.
 *
 * Examples:
 *   requireRole(user, 'manager') → passes for owner, admin, manager
 *   requireRole(user, 'owner')  → passes only for owner
 */
export function requireRole(user: AuthUser, minimumRole: UserRole): Result<void> {
  if (ROLE_LEVEL[user.role] < ROLE_LEVEL[minimumRole]) {
    return {
      success: false,
      error: `This action requires ${minimumRole} role or higher. Your role: ${user.role}.`,
    };
  }
  return { success: true, data: undefined };
}

/**
 * Checks whether the user has exactly the specified role.
 * Use when an action should be restricted to a single role only.
 */
export function requireExactRole(user: AuthUser, role: UserRole): Result<void> {
  if (user.role !== role) {
    return {
      success: false,
      error: `This action requires the ${role} role.`,
    };
  }
  return { success: true, data: undefined };
}

// ── Boolean Helpers ────────────────────────────────────────────────────────────

/**
 * True if the user has at least the specified role level.
 * Preferred for conditional UI rendering.
 */
export function hasRole(user: AuthUser, minimumRole: UserRole): boolean {
  return ROLE_LEVEL[user.role] >= ROLE_LEVEL[minimumRole];
}

/**
 * True if the user is the organization owner.
 */
export function isOwner(user: AuthUser): boolean {
  return user.role === 'owner';
}

// ── Session-Fetching Guards (async: load state, then redirect or return) ──────
//
// The guards above are pure — they take a user you already loaded. These load
// the session themselves, so a page body is one line:
//
//   const user = await requireActiveUser();
//
// They return a non-optional AuthUser, so pages need no `!` assertions.

/**
 * Loads the caller's auth state and requires a fully onboarded, active user.
 *
 * Redirect policy, in order of precedence:
 * - no session          → /login (preserving the attempted path in ?next=)
 * - session, no org     → /onboarding/setup (they already signed in; bouncing
 *                         them to /login would loop)
 * - deactivated         → /auth/logout, which clears the cookie first. Sending
 *                         them straight to /login would loop, because
 *                         middleware sees a still-valid session and returns
 *                         them here.
 */
export async function requireActiveUser(next?: string): Promise<AuthUser> {
  const state = await getAuthState();

  switch (state.status) {
    case 'authenticated':
      return state.user;

    case 'authenticated_no_org':
      redirect(ROUTES.onboarding.setup);

    case 'deactivated':
      redirect(`${ROUTES.auth.logout}?reason=deactivated`);

    case 'unauthenticated':
    case 'loading':
      redirect(
        next
          ? `${ROUTES.auth.login}?next=${encodeURIComponent(next)}`
          : ROUTES.auth.login
      );
  }
}

/**
 * For onboarding: requires a session but NOT yet an organization.
 *
 * Sending already-onboarded users to the dashboard is what stops
 * /onboarding/setup from being replayed to create a second organization.
 */
export async function requireOnboardingUser(): Promise<{
  userId: string;
  email: string;
}> {
  const state = await getAuthState();

  switch (state.status) {
    case 'authenticated_no_org':
      return { userId: state.userId, email: state.email };

    case 'authenticated':
      redirect(ROUTES.dashboard.home);

    case 'deactivated':
      redirect(`${ROUTES.auth.logout}?reason=deactivated`);

    case 'unauthenticated':
    case 'loading':
      redirect(ROUTES.auth.login);
  }
}

/**
 * Requires a minimum role, loading the session first.
 *
 * Redirects instead of throwing: an employee following a link to a settings
 * page should land somewhere usable rather than on an error screen. Use the
 * pure `requireRole` above inside Server Actions, where a Result is better.
 */
export async function requireMinimumRole(minimumRole: UserRole): Promise<AuthUser> {
  const user = await requireActiveUser();

  if (!hasRole(user, minimumRole)) {
    redirect(ROUTES.dashboard.home);
  }

  return user;
}
