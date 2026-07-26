/**
 * The auth context object itself, and nothing else.
 *
 * Kept in its own module because both AuthProvider (which writes to it) and
 * hooks.ts (which reads from it) need the exact same object identity. When each
 * file called createContext() itself, useAuth() read a different context than
 * the provider supplied, so it threw "must be used within AuthProvider" even
 * when correctly nested. Type-checking cannot catch that — both sides compile.
 *
 * Consumers should import from './hooks' (for useAuth) or './components/
 * AuthProvider'; this module is the shared internal seam.
 */

'use client';

import { createContext } from 'react';
import type { AuthState } from './types';

export interface AuthContextValue {
  /** Discriminated union — narrow on `status` before reading `user`. */
  state: AuthState;
  /** Re-reads auth state from the server (after onboarding or a role change). */
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
