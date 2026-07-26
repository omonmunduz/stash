/**
 * AUTH SERVICE
 *
 * Orchestrates authentication operations with Supabase Auth.
 * Handles signup, login, logout, password reset, and session management.
 *
 * Design decisions:
 * - Server-side only (uses server Supabase client)
 * - Returns Result<T> for operations that can fail
 * - Maps Supabase error messages to user-friendly strings
 * - Does NOT create organizations or profiles (that's onboarding's job)
 */

import type { AuthError as SupabaseAuthError } from '@supabase/supabase-js';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { AuthUser, SignupInput, LoginInput, AuthError, AuthErrorCode } from './types';
import type { Result, UserId, OrganizationId } from '@/lib/types/common';
import { signupSchema, loginSchema } from './validation';
import { getAppOrigin } from '@/lib/constants/app-url';
import { ROUTES } from '@/lib/constants/routes';

export class AuthService {
  constructor(private supabase: SupabaseServerClient) {}

  /**
   * Create a new user account.
   * Sends email verification.
   * Does NOT create organization or user_profile — that happens in onboarding.
   */
  async signUp(
    input: SignupInput,
    /**
     * Absolute URL Supabase sends the user to from the confirmation email.
     * Must be an allowed redirect URL in the Supabase dashboard, or the link
     * silently falls back to the project's Site URL.
     */
    emailRedirectTo?: string
  ): Promise<Result<{ userId: UserId; hasSession: boolean }>> {
    const parsed = signupSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const { data, error } = await this.supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName }, // Stored in raw_user_meta_data
        emailRedirectTo,
      },
    });

    if (error) return { success: false, error: mapAuthError(error).message };
    if (!data.user) return { success: false, error: 'Failed to create account' };

    return {
      success: true,
      data: {
        userId: data.user.id as UserId,
        /**
         * Whether the caller can proceed straight into the app.
         *
         * This reports data.session, not email_confirmed_at, because the
         * session is what actually determines the next step. With email
         * confirmation enabled (Supabase's default) signUp returns a user with
         * NO session, so navigating to a protected route would bounce the user
         * back to /login right after a successful signup.
         */
        hasSession: data.session !== null,
      },
    };
  }

  /**
   * Sign in with email and password.
   * Returns the authenticated user with organization context.
   * Returns null if user hasn't completed onboarding yet.
   */
  async signIn(input: LoginInput): Promise<Result<AuthUser | null>> {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) return { success: false, error: mapAuthError(error).message };
    if (!data.user) return { success: false, error: 'Sign in failed' };

    // Check if user has completed onboarding (has user_profile)
    const user = await this.getCurrentUser();

    return { success: true, data: user };
  }

  /**
   * Sign out the current user.
   * Clears the session cookie.
   */
  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  /**
   * Get the currently authenticated user with profile and organization.
   * Returns null if not authenticated or hasn't completed onboarding.
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return null;

    // Query user_profiles with organization joined
    // Type cast needed because generated types don't infer the join shape
    const { data: profile, error } = await this.supabase
      .from('user_profiles')
      .select('*, organization:organizations(id, name, slug)')
      .eq('id', user.id)
      .single() as any;

    if (error || !profile || !profile.organization) return null;

    return {
      id: user.id as UserId,
      email: user.email!,
      fullName: profile.full_name,
      role: profile.role,
      organizationId: profile.organization_id as OrganizationId,
      organization: {
        id: profile.organization.id as OrganizationId,
        name: profile.organization.name,
        slug: profile.organization.slug,
      },
    };
  }

  /**
   * Refresh the session to get a new JWT.
   * Important: Call this after updating app_metadata (e.g., after onboarding)
   * so the new claims are embedded in the JWT.
   */
  async refreshSession(): Promise<Result<void>> {
    const { error } = await this.supabase.auth.refreshSession();
    if (error) return { success: false, error: mapAuthError(error).message };
    return { success: true, data: undefined };
  }

  /**
   * Send a password reset email.
   * User will receive a link to /auth/callback?type=recovery
   */
  async resetPassword(email: string): Promise<Result<void>> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAppOrigin()}${ROUTES.auth.callback}?type=recovery`,
    });

    if (error) return { success: false, error: mapAuthError(error).message };

    // Deliberately reports success even when the email doesn't exist — Supabase
    // does the same. Distinguishing the two would turn this endpoint into an
    // account-enumeration oracle.
    return { success: true, data: undefined };
  }

  /**
   * Update the user's password.
   * Used after password reset or for changing password in settings.
   */
  async updatePassword(newPassword: string): Promise<Result<void>> {
    const { error } = await this.supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) return { success: false, error: mapAuthError(error).message };
    return { success: true, data: undefined };
  }
}

// ── Error Mapping ──────────────────────────────────────────────────────────────

/**
 * Map Supabase auth errors to user-friendly messages.
 */
function mapAuthError(error: SupabaseAuthError): AuthError {
  const code = getErrorCode(error.message);
  const message = getErrorMessage(code, error.message);
  return { code, message };
}

function getErrorCode(message: string): AuthErrorCode {
  if (message.includes('Invalid login credentials')) return 'invalid_credentials';
  if (message.includes('Email not confirmed')) return 'email_not_confirmed';
  if (message.includes('already registered')) return 'email_already_exists';
  if (message.includes('Password')) return 'weak_password';
  if (message.includes('rate limit')) return 'rate_limited';
  return 'unknown';
}

function getErrorMessage(code: AuthErrorCode, fallback: string): string {
  switch (code) {
    case 'invalid_credentials':
      return 'Incorrect email or password. Please try again.';
    case 'email_not_confirmed':
      return 'Please verify your email before logging in. Check your inbox for the verification link.';
    case 'email_already_exists':
      return 'An account with this email already exists. Try logging in instead.';
    case 'weak_password':
      return 'Password is too weak. Use at least 8 characters with a number.';
    case 'rate_limited':
      return 'Too many attempts. Please wait a few minutes and try again.';
    default:
      return fallback;
  }
}
