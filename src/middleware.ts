/**
 * MIDDLEWARE
 *
 * Runs before every request to:
 * 1. Refresh the Supabase session (keep JWT alive)
 * 2. Route users based on auth state
 *
 * Routing rules:
 * - No session → /login (except /signup and /auth/*)
 * - Session, no org claim → /onboarding/setup
 * - Session with org claim → allowed through
 * - Session on /login or /signup → /dashboard or /onboarding/setup
 * - /auth/* → always allowed, never redirected
 *
 * Design decisions:
 * - Reads JWT claims ONLY, never the database, so this stays cheap enough to run
 *   on every request.
 * - Claims lag reality: they're written with auth.admin.updateUserById() and
 *   only reach the cookie on the next token refresh. So a just-onboarded user
 *   may still lack organization_id here. That costs one redirect, which the
 *   page's authoritative check corrects.
 * - This is NOT a security boundary. It's routing UX. Middleware can be skipped
 *   by matcher gaps and it trusts unverified claims, so every protected page
 *   independently calls requireActiveUser(), and RLS backs that up in the
 *   database. Removing this file should not expose a single row.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';
import { ROUTES } from '@/lib/constants/routes';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — MUST be called to keep auth state alive
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // Sign-in / sign-up pages: for users WITHOUT a session.
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  // The /auth/* tree — callback, logout, password reset — must be reachable in
  // BOTH states and is never redirected. Logout has to work while signed in
  // (that's the point), and reset-password has to work while signed out. Gating
  // these on session state is what creates sign-out redirect loops.
  const isAuthMechanismRoute = pathname.startsWith('/auth/');

  const isOnboardingRoute = pathname.startsWith('/onboarding');
  const isPublicRoute = isAuthPage || isAuthMechanismRoute;

  // Claims only — no DB query, so middleware stays fast. Claims lag reality
  // (they land on token refresh), so this decides ROUTING only. Every protected
  // page re-checks against the database via requireActiveUser().
  const hasOrgClaim = Boolean(user?.app_metadata?.organization_id);

  // Never redirect the auth mechanism routes, in either state.
  if (isAuthMechanismRoute) {
    return supabaseResponse;
  }

  // Root has no page — send visitors somewhere real rather than a 404.
  if (pathname === '/') {
    url.pathname = !user
      ? ROUTES.auth.login
      : hasOrgClaim
        ? ROUTES.dashboard.home
        : ROUTES.onboarding.setup;
    return NextResponse.redirect(url);
  }

  // --- No session ---
  if (!user) {
    if (isPublicRoute) return supabaseResponse;

    url.pathname = ROUTES.auth.login;
    // Preserve the destination so login can return them there. Only the path is
    // carried, never an absolute URL from user input — that's an open redirect.
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // --- Has a session, sitting on /login or /signup ---
  if (isAuthPage) {
    url.pathname = hasOrgClaim ? ROUTES.dashboard.home : ROUTES.onboarding.setup;
    url.search = '';
    return NextResponse.redirect(url);
  }

  // --- Has a session, no organization claim ---
  // Push into onboarding, but never fight the onboarding routes themselves.
  if (!hasOrgClaim && !isOnboardingRoute) {
    url.pathname = ROUTES.onboarding.setup;
    return NextResponse.redirect(url);
  }

  // --- Onboarded user replaying /onboarding/setup ---
  // Later steps stay reachable; only org creation is one-time.
  if (hasOrgClaim && pathname === ROUTES.onboarding.setup) {
    url.pathname = ROUTES.dashboard.home;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run on all paths except static assets and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
