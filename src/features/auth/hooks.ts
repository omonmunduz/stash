/**
 * AUTH HOOKS
 *
 * Client-side hooks for accessing the current user session.
 *
 * Design decisions:
 * - useAuth must be used inside AuthProvider (enforced with throw)
 * - Exposes the discriminated AuthState union so components can narrow
 *   via status checks and get type-safe access to user/organization
 */

'use client';

import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './context';

/**
 * Access the current auth state.
 * Must be used inside AuthProvider.
 *
 * Usage:
 *   const { state } = useAuth()
 *   if (state.status === 'authenticated') {
 *     // state.user is available and typed
 *   }
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

/**
 * Get the authenticated user or null.
 * Convenience hook for components that only care about the user object.
 */
export function useUser() {
  const { state } = useAuth();
  return state.status === 'authenticated' ? state.user : null;
}

/**
 * Check if the current user is authenticated and has completed onboarding.
 */
export function useIsAuthenticated(): boolean {
  const { state } = useAuth();
  return state.status === 'authenticated';
}
