/**
 * AUTH PROVIDER
 *
 * Exposes auth state to client components.
 *
 * Design decisions:
 * - initialState comes from the server layout, so the first paint already knows
 *   who the user is (no loading spinner, no fetch-on-mount waterfall).
 * - The context object lives in ../context so this file and hooks.ts share one
 *   identity. Calling createContext() in both is invisible to the compiler and
 *   makes useAuth() throw even when correctly nested.
 * - Row→state mapping is shared with the server path via ../profile-mapper, so
 *   a deactivated user can't be blocked on one side and admitted on the other.
 * - Deactivated users are pushed to /auth/logout rather than signed out here:
 *   the route handler can clear the cookie and explain why they were ejected.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AuthContext } from '../context';
import type { AuthState } from '../types';
import {
  PROFILE_SELECT,
  mapProfileToAuthState,
  type ProfileWithOrganization,
} from '../profile-mapper';
import { ROUTES } from '@/lib/constants/routes';

interface AuthProviderProps {
  children: React.ReactNode;
  /** Resolved server-side by the layout, so state is correct on first render. */
  initialState: AuthState;
}

export function AuthProvider({ children, initialState }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(initialState);
  // createClient() builds a new client per call, so memoize it: an unstable
  // reference would re-run the onAuthStateChange effect on every render,
  // resubscribing and leaking listeners.
  const supabase = useMemo(() => createClient(), []);

  const refresh = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setState({ status: 'unauthenticated' });
      return;
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select(PROFILE_SELECT)
      .eq('id', user.id)
      .maybeSingle<ProfileWithOrganization>();

    if (error) {
      // Keep the last known good state. Treating a transient query failure as
      // "no organization" would yank an onboarded user into setup mid-session.
      console.error('[AuthProvider] Failed to refresh profile:', error.message);
      return;
    }

    setState(mapProfileToAuthState(data, user.id, user.email ?? ''));
  }, [supabase]);

  // Cross-tab sign-out, and token refreshes that finally deliver the
  // organization_id claim set during onboarding.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        setState({ status: 'unauthenticated' });
        return;
      }

      // INITIAL_SESSION fires on mount with what the server already gave us;
      // re-querying on it is a wasted round trip on every page load.
      if (event === 'INITIAL_SESSION') return;

      void refresh();
    });

    return () => subscription.unsubscribe();
  }, [supabase, refresh]);

  // A session that outlives its profile being deactivated: leave via the logout
  // route so the cookie is actually cleared. Doing this in an effect (not during
  // render) keeps the render pure.
  useEffect(() => {
    if (state.status === 'deactivated') {
      window.location.assign(`${ROUTES.auth.logout}?reason=deactivated`);
    }
  }, [state.status]);

  return (
    <AuthContext.Provider value={{ state, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
