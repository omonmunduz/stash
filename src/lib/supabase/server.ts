/**
 * Supabase server client.
 * Use in Server Components, Server Actions, and API routes.
 *
 * Reads the auth session from cookies — requires Next.js cookies() API.
 * Must be called inside a request context (not at module initialization).
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookie setting is a no-op.
            // The middleware handles session refresh.
          }
        },
      },
    }
  );
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
