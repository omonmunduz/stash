/**
 * EMPLOYEE SERVICE FACTORY (server-only)
 */

import { createClient } from '@/lib/supabase/server';
import { requireActiveUser } from '@/features/auth/guards';
import { SupabaseEmployeeRepository } from './repository';
import { EmployeeService } from './service';
import type { AuthUser } from '@/features/auth/types';
import type { OrganizationId } from '@/lib/types/common';

export async function getEmployeeService(): Promise<{
  service: EmployeeService;
  user: AuthUser;
  organizationId: OrganizationId;
}> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  return {
    service: new EmployeeService(
      new SupabaseEmployeeRepository(supabase),
      user.organizationId
    ),
    user,
    organizationId: user.organizationId,
  };
}
