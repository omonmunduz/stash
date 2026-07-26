/**
 * Supabase browser client.
 * Use in Client Components only.
 *
 * Never import this in Server Components or API routes —
 * use createServerClient() from @/lib/supabase/server.ts instead.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type SupabaseBrowserClient = ReturnType<typeof createClient>;
