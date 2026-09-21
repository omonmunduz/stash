import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type Locale = 'en' | 'ru';

export const locales: Locale[] = ['en', 'ru'];
export const defaultLocale: Locale = 'en';

/**
 * Determine the locale for this request.
 *
 * Priority:
 * 1. Public org pages ([org-slug]) - use organization's default_locale
 * 2. Cookie override (for dashboard where user chooses language)
 * 3. Authenticated user's locale preference (CRM)
 * 4. Default to 'en'
 */
async function getLocale(): Promise<Locale> {
  // Check if this is a public org page via custom header set by middleware
  const headersList = await headers();
  const orgSlug = headersList.get('x-org-slug');

  // For public org pages, use organization's default_locale
  if (orgSlug) {
    try {
      const supabase = await createClient();
      const { data: org } = await supabase
        .from('organizations')
        .select('default_locale')
        .eq('slug', orgSlug)
        .is('deleted_at', null)
        .maybeSingle();

      if (org?.default_locale && locales.includes(org.default_locale as Locale)) {
        return org.default_locale as Locale;
      }
    } catch (error) {
      console.error('Error fetching org locale:', error);
    }
  }

  // For dashboard/authenticated pages, use cookie or user preference
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined;

  if (cookieLocale && locales.includes(cookieLocale)) {
    return cookieLocale;
  }

  // Try to get authenticated user's preference
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('locale')
        .eq('id', user.id)
        .single();

      if (profile?.locale && locales.includes(profile.locale as Locale)) {
        return profile.locale as Locale;
      }
    }
  } catch (error) {
    // If auth check fails, continue to fallbacks
    console.error('Error fetching user locale:', error);
  }

  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await getLocale();

  return {
    locale,
    messages: {
      common: (await import(`../../messages/${locale}/common.json`)).default,
      dashboard: (await import(`../../messages/${locale}/dashboard.json`)).default,
      landing: (await import(`../../messages/${locale}/landing.json`)).default,
      auth: (await import(`../../messages/${locale}/auth.json`)).default,
      customers: (await import(`../../messages/${locale}/customers.json`)).default,
      products: (await import(`../../messages/${locale}/products.json`)).default,
      sales: (await import(`../../messages/${locale}/sales.json`)).default,
      inventory: (await import(`../../messages/${locale}/inventory.json`)).default,
      payments: (await import(`../../messages/${locale}/payments.json`)).default,
      expenses: (await import(`../../messages/${locale}/expenses.json`)).default,
      services: (await import(`../../messages/${locale}/services.json`)).default,
      employees: (await import(`../../messages/${locale}/employees.json`)).default,
      appointments: (await import(`../../messages/${locale}/appointments.json`)).default,
      reports: (await import(`../../messages/${locale}/reports.json`)).default,
      settings: (await import(`../../messages/${locale}/settings.json`)).default,
    },
  };
});
