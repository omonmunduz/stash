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
 *
 * The token supplies identity only — the `sub` and `email` that Auth itself
 * mints. Organization, role, and active status are always read from
 * user_profiles, so deactivating or demoting a user takes effect on their very
 * next request.
 *
 * Trade-off worth knowing: verifying the signature locally means a session
 * revoked server-side (admin sign-out, "sign out everywhere") stays usable until
 * the access token expires — one hour by default. getUser() caught that within
 * the round trip it cost. Deactivation, the case this app actually uses, is
 * still immediate because is_active comes from the query below.
 */

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getJwks } from '@/lib/supabase/jwks';
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
 *
 * Memoized per request with React's cache(). Every feature's server.ts factory
 * calls requireActiveUser(), and generateMetadata runs as a second pass
 * alongside the page body — without this, one navigation resolved auth two or
 * three times, and each resolution is two serial network round trips. The cache
 * is scoped to a single request, so no state is shared between users.
 */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const supabase = await createClient();

  // Identity comes from the JWT's verified signature, not from a call to the
  // Auth server. This project signs with ES256, so getClaims() checks the
  // signature with WebCrypto against a module-cached JWKS — no network call on a
  // warm server instance, where getUser() was a full round trip on every render
  // pass. Only `sub` and `email` are read: both are standard claims minted by
  // Auth itself, not the custom claims the header warns about.
  //
  // Session refresh is preserved. With no jwt argument getClaims() resolves
  // through getSession(), which refreshes a token inside its expiry margin.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
    undefined,
    { jwks: await getJwks() }
  );

  const claims = claimsData?.claims;

  if (claimsError || !claims) {
    return { status: 'unauthenticated' };
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select(PROFILE_SELECT)
    .eq('id', claims.sub)
    .maybeSingle<ProfileWithOrganization>();

  if (error) {
    // A real failure (network, RLS misconfiguration) must not be reported as
    // "no organization" — that would push an onboarded owner back through setup
    // and let them create a second organization.
    throw new Error(`Failed to load user profile: ${error.message}`);
  }

  return mapProfileToAuthState(data, claims.sub, claims.email ?? '');
});
