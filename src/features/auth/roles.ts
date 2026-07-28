/**
 * ROLE COMPARISON (isomorphic — safe in Client Components)
 *
 * Role ranking is pure logic, but it used to live in guards.ts alongside the
 * async guards that import the Supabase server client. Any Client Component that
 * wanted a role check therefore pulled `next/headers` into the browser bundle and
 * failed the build.
 *
 * Splitting it out keeps the comparison importable from either side. guards.ts
 * re-exports these so existing server-side imports keep working.
 *
 * This is a UI-affordance check, not a security boundary. Hiding a nav link is
 * not authorization — every write still re-checks the role server-side via
 * requireMinimumRole().
 */

import type { AuthUser } from './types';
import type { UserRole } from '@/features/users/types';

/**
 * Roles are ranked, not a set: "manager or above" is the common requirement, and
 * a numeric level expresses it without enumerating every role at each call site.
 */
export const ROLE_LEVEL: Record<UserRole, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  employee: 1,
};

/** True when the user's role is at or above `minimumRole`. */
export function hasRole(user: AuthUser, minimumRole: UserRole): boolean {
  return ROLE_LEVEL[user.role] >= ROLE_LEVEL[minimumRole];
}

/** True if the user is the organization owner. */
export function isOwner(user: AuthUser): boolean {
  return user.role === 'owner';
}
