/**
 * AUTH DOMAIN TYPES
 *
 * Types for authentication and session management.
 *
 * Design decisions:
 * - AuthUser includes organization context so every part of the app
 *   can access it without extra queries.
 * - AuthState is a discriminated union so TypeScript enforces that
 *   the user and organization are present when status is 'authenticated'.
 * - The three auth states map directly to the three route groups:
 *   (auth), (onboarding), (dashboard).
 */

import type { UserId, OrganizationId } from '@/lib/types/common';
import type { UserRole } from '@/features/users/types';

/**
 * The authenticated user with full organization context.
 * This is what every part of the app receives after login.
 */
export interface AuthUser {
  id: UserId;
  email: string;
  fullName: string;
  role: UserRole;
  organizationId: OrganizationId;
  organization: {
    id: OrganizationId;
    name: string;
    slug: string;
  };
}

/**
 * Three-state model for the auth lifecycle.
 *
 * State 1: unauthenticated → show /login or /signup
 * State 2: authenticated_no_org → show /onboarding/*
 * State 3: authenticated → show /dashboard/*
 *
 * 'loading' is the initial state while session is being checked.
 */
export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated_no_org'; userId: string; email: string }
  | { status: 'authenticated'; user: AuthUser }
  /**
   * Profile exists but is_active = false (or soft-deleted).
   *
   * This is deliberately NOT collapsed into 'unauthenticated': the user still
   * holds a valid session cookie. Server Components cannot clear cookies, so
   * callers must redirect to the /auth/logout route handler, which can.
   * Treating this as 'unauthenticated' causes a redirect loop.
   */
  | { status: 'deactivated' };

/** Input for creating a new account */
export interface SignupInput {
  fullName: string;
  email: string;
  password: string;
}

/** Input for signing in */
export interface LoginInput {
  email: string;
  password: string;
}

/** Input for resetting a password */
export interface ResetPasswordInput {
  email: string;
}

/** Input for setting a new password (after reset email) */
export interface UpdatePasswordInput {
  password: string;
  confirmPassword: string;
}

/**
 * Data written to auth.users.app_metadata during onboarding.
 * Embedded in the JWT on every subsequent login.
 */
export interface AuthMetaClaims {
  organization_id: string;
  role: UserRole;
}

/**
 * Auth error codes mapped from Supabase error messages.
 */
export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'email_already_exists'
  | 'weak_password'
  | 'rate_limited'
  | 'unknown';

export interface AuthError {
  code: AuthErrorCode;
  message: string;
}
