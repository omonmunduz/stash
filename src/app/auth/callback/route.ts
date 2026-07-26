/**
 * Auth callback route.
 *
 * Handles:
 * 1. Email verification (user clicks link from verification email)
 * 2. Password reset (user clicks link from password reset email)
 * 3. OAuth redirects (if OAuth is added in Phase 2)
 *
 * Supabase redirects here with a code that needs to be exchanged for a session.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/lib/constants/routes';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type'); // 'signup', 'recovery', 'invite'
  const next = requestUrl.searchParams.get('next') ?? ROUTES.dashboard.home;

  // If there's a code, exchange it for a session
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback error:', error);
      return NextResponse.redirect(
        new URL(`${ROUTES.auth.login}?error=auth_failed`, requestUrl.origin)
      );
    }

    // Redirect based on auth type
    if (type === 'recovery') {
      // Password reset — redirect to change password page
      return NextResponse.redirect(
        new URL('/auth/update-password', requestUrl.origin)
      );
    }

    if (type === 'signup') {
      // Email verification after signup — redirect to onboarding
      return NextResponse.redirect(
        new URL(ROUTES.onboarding.setup, requestUrl.origin)
      );
    }

    // Default: redirect to next URL or dashboard
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  // No code provided — redirect to login with error
  return NextResponse.redirect(
    new URL(`${ROUTES.auth.login}?error=missing_code`, requestUrl.origin)
  );
}
