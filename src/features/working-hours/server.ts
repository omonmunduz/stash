import { createClient } from '@/lib/supabase/server';
import { getAuthState } from '@/features/auth/session';
import { SupabaseWorkingHoursRepository } from './repository';
import { WorkingHoursService } from './service';

export async function getWorkingHoursService() {
  const supabase = await createClient();
  const state = await getAuthState();

  if (state.status !== 'authenticated') {
    throw new Error('User must be authenticated and belong to an organization');
  }

  const repository = new SupabaseWorkingHoursRepository(
    supabase,
    state.user.organizationId
  );

  return new WorkingHoursService(repository);
}
