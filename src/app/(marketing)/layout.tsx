/**
 * MARKETING LAYOUT
 *
 * Layout for public marketing pages (home, product, pricing, etc.)
 * Includes header with navigation and language switcher, plus footer.
 */

import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMarketingLocale } from '@/lib/i18n/marketing-locale';
import { MarketingHeader } from './components/MarketingHeader';
import { MarketingFooter } from './components/MarketingFooter';

interface MarketingLayoutProps {
  children: ReactNode;
}

export default async function MarketingLayout({ children }: MarketingLayoutProps) {
  const locale = await getMarketingLocale();

  // Load marketing messages
  const messages = {
    marketing: (await import(`../../../messages/${locale}/marketing.json`)).default,
    common: (await import(`../../../messages/${locale}/common.json`)).default,
  };

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <div className="flex min-h-screen flex-col">
        <MarketingHeader />
        <main className="flex-1">{children}</main>
        <MarketingFooter />
      </div>
    </NextIntlClientProvider>
  );
}
