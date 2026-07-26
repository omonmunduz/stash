/**
 * Server-side authentication state resolution.
 *
 * This is the ONLY place that decides "who is this request, and what can they
 * see". Everything else (pages, layouts, lib/supabase/session.ts) delegates
 * here so there is exactly one query shape and one set of rules.
 *
 * Design rule: this function NEVER trusts JWT custom claims.
 * Claims are set with auth.admin.updateUserById() and only reach the cookie
 * after a token refresh, so they lag reality — a freshly-onboarded user has no
 * organization_id claim yet, and a demoted user still carries the old role.
 * Middleware reads claims (cheap, no DB) purely to route; correctness is
 * decided here, against the database.
 */

import { createClient } from '@/lib/supabase/server';
import type { AuthState } from './types';
import {
  PROFILE_SELECT,
  mapProfileToAuthState,
  type ProfileWithOrganization,
} from './profile-mapper';

/**
 * Resolves the caller's auth state from the session cookie + database.
 *
 * Does NOT sign anyone out or redirect — a Server Component cannot write
 * cookies, so a signOut() here would silently fail and leave the caller
 * bouncing between the guard and the login page. Callers handle each status.
 */
export async function getAuthState(): Promise<AuthState> {
  const supabase = await createClient();

  // getUser() validates the JWT against Supabase Auth rather than decoding it
  // locally, so a revoked or expired session is caught here.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { status: 'unauthenticated' };
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select(PROFILE_SELECT)
    .eq('id', user.id)
    .maybeSingle<ProfileWithOrganization>();

  if (error) {
    // A real failure (network, RLS misconfiguration) must not be reported as
    // "no organization" — that would push an onboarded owner back through setup
    // and let them create a second organization.
    throw new Error(`Failed to load user profile: ${error.message}`);
  }

  return mapProfileToAuthState(data, user.id, user.email ?? '');
}
