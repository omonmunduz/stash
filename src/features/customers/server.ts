/**
 * CUSTOMER SERVICE FACTORY (server-only)
 *
 * Wires the Supabase client, the repository, and the service together for the
 * current request. Server Components and Server Actions both need a service
 * instance; without this they would each repeat the same three lines and could
 * drift on which organization ID they scope to.
 *
 * Kept separate from service.ts so the service class itself stays free of
 * next/headers imports and remains unit-testable with a fake repository.
 */

import { createClient } from '@/lib/supabase/server';
import { requireActiveUser } from '@/features/auth/guards';
import { SupabaseCustomerRepository } from './repository';
import { CustomerService } from './service';
import type { AuthUser } from '@/features/auth/types';

/**
 * Build a customer service scoped to the signed-in user's organization.
 *
 * Returns the user alongside the service because callers almost always need
 * both (role checks for conditional UI, created_by attribution), and resolving
 * the session twice per request is wasteful.
 */
export async function getCustomerService(): Promise<{
  service: CustomerService;
  user: AuthUser;
}> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  return {
    service: new CustomerService(new SupabaseCustomerRepository(supabase), user.organizationId),
    user,
  };
}
