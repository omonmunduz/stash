/**
 * APPOINTMENT SERVICE FACTORY (server-only)
 */

import { createClient } from '@/lib/supabase/server';
import { requireActiveUser } from '@/features/auth/guards';
import { SupabaseAppointmentRepository } from './repository';
import { AppointmentService } from './service';
import type { AuthUser } from '@/features/auth/types';

export async function getAppointmentService(): Promise<{
  service: AppointmentService;
  user: AuthUser;
}> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  return {
    service: new AppointmentService(
      new SupabaseAppointmentRepository(supabase),
      user.organizationId
    ),
    user,
  };
}
