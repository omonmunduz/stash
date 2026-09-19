'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type Locale = 'en' | 'ru';

/**
 * Set the user's locale preference.
 *
 * For authenticated users: saves to user_profiles.locale
 * For anonymous visitors: saves to cookie only
 */
export async function setUserLocale(locale: Locale) {
  const cookieStore = await cookies();

  // Always set cookie for immediate effect
  cookieStore.set('NEXT_LOCALE', locale, {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
  });

  // Try to update user profile if authenticated
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase
        .from('user_profiles')
        .update({ locale })
        .eq('id', user.id);

      if (error) {
        console.error('Failed to update user locale:', error);
      }
    }
  } catch (error) {
    console.error('Error in setUserLocale:', error);
  }

  // Revalidate to apply new locale
  revalidatePath('/', 'layout');
}

/**
 * Set the organization's default locale (owner only).
 */
export async function setOrganizationLocale(locale: Locale) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get user's org and role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'owner') {
    return { success: false, error: 'Only owners can change organization locale' };
  }

  const { error } = await supabase
    .from('organizations')
    .update({ default_locale: locale })
    .eq('id', profile.organization_id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}
