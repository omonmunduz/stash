/**
 * Sign-out endpoint.
 *
 * Exists as a Route Handler rather than living inside a Server Action or page
 * because clearing the session means writing cookies, and only Route Handlers
 * and Server Actions can do that. A signOut() call in a Server Component is a
 * silent no-op — the cookie survives and the user stays signed in.
 *
 * Accepts both:
 * - GET, so a guard can `redirect()` here (browser navigations are GETs)
 * - POST, for the sign-out button, which shouldn't be triggerable by a
 *   prefetch or an <img> tag
 *
 * ?reason=deactivated surfaces a message on the login page, so a disabled
 * employee is told why they were signed out instead of silently ejected.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/lib/constants/routes';

const VALID_REASONS = new Set(['deactivated', 'expired']);

async function signOutAndRedirect(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  // 'local' clears this browser's session only. A deactivated user's other
  // sessions are handled by disabling the account server-side, not here.
  await supabase.auth.signOut({ scope: 'local' });

  const reason = request.nextUrl.searchParams.get('reason');
  const target = new URL(ROUTES.auth.login, request.url);

  // Only echo back known reasons — never reflect arbitrary query input into the
  // next URL, which is how open-redirect and injection bugs start.
  if (reason && VALID_REASONS.has(reason)) {
    target.searchParams.set('reason', reason);
  }

  return NextResponse.redirect(target);
}

export async function GET(request: NextRequest) {
  return signOutAndRedirect(request);
}

export async function POST(request: NextRequest) {
  return signOutAndRedirect(request);
}
