/**
 * AUTH SERVER ACTIONS
 *
 * Server-side mutations for authentication flows.
 * Called from client components via form submissions.
 *
 * Design decisions:
 * - Return Result<T> instead of throwing, so errors are user-friendly
 * - Validation happens server-side (never trust client input)
 * - redirect() is called after successful mutations to prevent back-button issues
 */

'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AuthService } from '@/features/auth/service';
import { createOrganizationWithOwner } from '@/features/auth/onboarding-service';
import type { Result, UserId } from '@/lib/types/common';
import type { SignupInput, LoginInput } from '@/features/auth/types';
import { ROUTES } from '@/lib/constants/routes';
import { getAppOrigin } from '@/lib/constants/app-url';

/**
 * Sign up a new user.
 * Creates auth.users record and sends verification email.
 * Does NOT create organization — that happens in onboarding.
 */
export async function signUpAction(
  input: SignupInput
): Promise<Result<{ needsVerification: boolean }>> {
  const supabase = await createClient();
  const authService = new AuthService(supabase);

  // Absolute URL for the confirmation email. Built from a configured origin
  // rather than a request header, so a spoofed Host cannot redirect a real
  // user's confirmation link to an attacker's domain.
  const result = await authService.signUp(
    input,
    `${getAppOrigin()}${ROUTES.auth.callback}`
  );

  if (!result.success) {
    return result;
  }

  // No session means email confirmation is required. Redirecting into the app
  // here would bounce straight back to /login, so report it and let the form
  // show a "check your inbox" message instead.
  if (!result.data.hasSession) {
    return { success: true, data: { needsVerification: true } };
  }

  redirect(ROUTES.onboarding.setup);
}

/**
 * Sign in an existing user.
 * Returns error if credentials are invalid.
 * Redirects based on whether they have completed onboarding.
 */
export async function signInAction(input: LoginInput): Promise<Result<void>> {
  const supabase = await createClient();
  const authService = new AuthService(supabase);

  const result = await authService.signIn(input);

  if (!result.success) {
    return result;
  }

  // Redirect based on whether user has organization
  if (result.data === null) {
    // User exists but no organization yet
    redirect(ROUTES.onboarding.setup);
  } else {
    // User fully onboarded
    redirect(ROUTES.dashboard.home);
  }
}

/**
 * Sign-out lives at the /auth/logout route handler, not here.
 *
 * A route handler can be reached by a GET redirect, which is what guards need
 * when they eject a deactivated user — redirect() issues a browser navigation,
 * and a Server Action cannot serve one. Keeping a second sign-out path here
 * would let the two drift apart, so callers should POST to ROUTES.auth.logout.
 */

/**
 * Create an organization for the current user.
 * This is Step 2 of onboarding, called from /onboarding/setup.
 *
 * Uses the admin client because new users have no organization yet,
 * and RLS blocks them from creating one.
 */
export async function createOrganizationAction(input: {
  organizationName: string;
}): Promise<Result<{ organizationId: string }>> {
  // Get current user
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: 'You must be logged in to create an organization.',
    };
  }

  // Get user's full name from user_metadata (set during signup)
  const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

  const result = await createOrganizationWithOwner({
    userId: user.id as UserId,
    organizationName: input.organizationName,
    userFullName: fullName,
    userEmail: user.email!,
  });

  if (!result.success) {
    return result;
  }

  // Redirect to next onboarding step
  redirect(ROUTES.onboarding.preferences);
}

/**
 * Request a password reset email.
 */
export async function resetPasswordAction(input: {
  email: string;
}): Promise<Result<void>> {
  const supabase = await createClient();
  const authService = new AuthService(supabase);

  return authService.resetPassword(input.email);
}

/**
 * Update the user's password (after reset or in settings).
 */
export async function updatePasswordAction(input: {
  password: string;
}): Promise<Result<void>> {
  const supabase = await createClient();
  const authService = new AuthService(supabase);

  const result = await authService.updatePassword(input.password);

  if (!result.success) {
    return result;
  }

  // Redirect to dashboard after successful password update
  redirect(ROUTES.dashboard.home);
}
