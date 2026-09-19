import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type Locale = 'en' | 'ru';

export const locales: Locale[] = ['en', 'ru'];
export const defaultLocale: Locale = 'en';

/**
 * Determine the locale for this request.
 *
 * Priority:
 * 1. Cookie override (for public pages where visitor chooses language)
 * 2. Authenticated user's locale preference (CRM)
 * 3. Organization's default locale (public pages)
 * 4. Browser Accept-Language header
 * 5. Default to 'en'
 */
async function getLocale(): Promise<Locale> {
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
