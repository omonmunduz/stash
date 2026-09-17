/**
 * SERVICE SERVICE FACTORY (server-only)
 */

import { createClient } from '@/lib/supabase/server';
import { requireActiveUser } from '@/features/auth/guards';
import { SupabaseServiceRepository } from './repository';
import { ServiceService } from './service';
import type { AuthUser } from '@/features/auth/types';

export async function getServiceService(): Promise<{
  service: ServiceService;
  user: AuthUser;
}> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  return {
    service: new ServiceService(
      new SupabaseServiceRepository(supabase),
      user.organizationId
    ),
    user,
  };
}
