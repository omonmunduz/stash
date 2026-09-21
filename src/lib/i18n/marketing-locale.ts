/**
 * Get locale for marketing site.
 *
 * Uses SITE_LANG cookie set by middleware based on geo-detection,
 * or explicit ?lang= query param override.
 */

import { cookies } from 'next/headers';

export type MarketingLocale = 'en' | 'ru';

export async function getMarketingLocale(): Promise<MarketingLocale> {
  const cookieStore = await cookies();
  const siteLang = cookieStore.get('SITE_LANG')?.value as MarketingLocale | undefined;

  // Fallback to Russian if cookie not set (should be set by middleware)
  return siteLang && ['en', 'ru'].includes(siteLang) ? siteLang : 'ru';
}
