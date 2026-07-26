/**
 * Root layout.
 *
 * Design decisions:
 * - Inter is loaded with the cyrillic subset because Russian and Kyrgyz are
 *   MVP languages (see docs/ONBOARDING.md). Without the subset, ru/ky text
 *   falls back to a system font and looks inconsistent beside Latin text.
 * - display: 'swap' keeps text visible during font load rather than blocking.
 * - lang is hardcoded to 'en' for now; it becomes dynamic when i18n ships.
 * - No AuthProvider here. The provider needs the current session, which is
 *   only known inside the (dashboard) and (onboarding) groups. Wrapping the
 *   root would force a session lookup on public pages that do not need one.
 */

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
