/**
 * Root layout.
 *
 * Design decisions:
 * - Inter is loaded with the cyrillic subset because Russian and Kyrgyz are
 *   MVP languages (see docs/ONBOARDING.md). Without the subset, ru/ky text
 *   falls back to a system font and looks inconsistent beside Latin text.
 * - display: 'swap' keeps text visible during font load rather than blocking.
 * - lang is set dynamically based on user locale (en/ru).
 * - No session lookup here. Public pages do not need one, and the authenticated
 *   groups resolve it themselves in their own layouts.
 */

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Stash',
    template: '%s · Stash',
  },
  description: 'Wholesale business management — customers, credit, inventory, and sales.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom is intentionally left enabled — disabling it is an accessibility failure.
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={inter.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
