/**
 * Organization actions (server-side)
 *
 * Handles organization settings updates.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireActiveUser } from '@/features/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/lib/constants/routes';

const updatePreferencesSchema = z.object({
  currency: z.string().min(3).max(3),
  timezone: z.string().min(1).max(100),
});

export async function updateOrganizationPreferencesAction(
  values: z.infer<typeof updatePreferencesSchema>
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireActiveUser();

    // Validate input
    const parsed = updatePreferencesSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: 'Invalid input' };
    }

    const { currency, timezone } = parsed.data;

    const supabase = await createClient();

    // Get current settings
    const { data: org, error: fetchError } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', user.organization.id)
      .single();

    if (fetchError || !org) {
      console.error('Failed to fetch organization:', fetchError);
      return { success: false, error: 'Failed to fetch organization' };
    }

    // Merge new preferences into settings
    const settings = {
      ...(typeof org.settings === 'object' && org.settings !== null ? org.settings : {}),
      currency,
      timezone,
    };

    // Update organization
    const { error } = await supabase
      .from('organizations')
      .update({
        settings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.organization.id);

    if (error) {
      console.error('Failed to update organization preferences:', error);
      return { success: false, error: 'Failed to update preferences' };
    }

    revalidatePath(ROUTES.dashboard.home);

    return { success: true };
  } catch (error) {
    console.error('Error in updateOrganizationPreferencesAction:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
