/**
 * PRODUCT SERVICE FACTORY (server-only)
 *
 * Wires the Supabase client, repository, and service for the current request.
 * Kept out of service.ts so the service class stays free of next/headers and
 * remains testable with a fake repository.
 */

import { createClient } from '@/lib/supabase/server';
import { requireActiveUser } from '@/features/auth/guards';
import { SupabaseProductRepository } from './repository';
import { ProductService } from './service';
import type { AuthUser } from '@/features/auth/types';

/**
 * Build a product service scoped to the signed-in user's organization.
 *
 * Returns the user too, because callers almost always need both — role checks
 * for conditional UI, and resolving the session twice per request is wasteful.
 */
export async function getProductService(): Promise<{
  service: ProductService;
  user: AuthUser;
}> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  return {
    service: new ProductService(new SupabaseProductRepository(supabase), user.organizationId),
    user,
  };
}
