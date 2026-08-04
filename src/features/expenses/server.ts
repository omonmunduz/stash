/**
 * EXPENSE SERVICE FACTORY (server-only)
 *
 * Wires the Supabase client, repository, and service for the current request.
 */

import { createClient } from '@/lib/supabase/server';
import { requireActiveUser } from '@/features/auth/guards';
import { SupabaseExpenseRepository } from './repository';
import { ExpenseService } from './service';
import type { AuthUser } from '@/features/auth/types';

/** Build an expense service scoped to the signed-in user's organization. */
export async function getExpenseService(): Promise<{
  service: ExpenseService;
  user: AuthUser;
}> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  return {
    service: new ExpenseService(
      new SupabaseExpenseRepository(supabase),
      user.organizationId
    ),
    user,
  };
}
