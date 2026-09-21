/**
 * Get locale for public organization pages.
 *
 * Returns the organization's default_locale from the database.
 * This ensures the public page renders in the business's language,
 * not the visitor's personal preference.
 */

import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/i18n/request';

export async function getPublicOrgLocale(orgSlug: string): Promise<Locale> {
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('default_locale')
    .eq('slug', orgSlug)
    .is('deleted_at', null)
    .maybeSingle();

  const locale = org?.default_locale as Locale | null;

  // Fallback to 'en' if org not found or locale is invalid
  return locale && ['en', 'ru'].includes(locale) ? locale : 'en';
}
