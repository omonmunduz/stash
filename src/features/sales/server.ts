/**
 * SALE SERVICE FACTORY (server-only)
 *
 * Wires the Supabase client, repositories, and service for the current request.
 */

import { createClient } from '@/lib/supabase/server';
import { requireActiveUser } from '@/features/auth/guards';
import { SupabaseSaleRepository } from './repository';
import { SupabaseProductRepository } from '@/features/products/repository';
import { SupabaseCustomerRepository } from '@/features/customers/repository';
import { SaleService } from './service';
import type { AuthUser } from '@/features/auth/types';

/**
 * Build a sale service scoped to the signed-in user's organization.
 *
 * Returns the user too, because callers almost always need both — role checks
 * for conditional UI, and resolving the session twice per request is wasteful.
 */
export async function getSaleService(): Promise<{
  service: SaleService;
  user: AuthUser;
}> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  return {
    service: new SaleService(
      new SupabaseSaleRepository(supabase),
      new SupabaseProductRepository(supabase),
      new SupabaseCustomerRepository(supabase),
      user.organizationId
    ),
    user,
  };
}
