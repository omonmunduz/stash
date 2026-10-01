/**
 * BUSINESS HEADER
 *
 * Dynamic header for public landing page.
 * Navigation adapts based on available services/products.
 */

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface BusinessHeaderProps {
  orgName: string;
  orgSlug: string;
  logoUrl: string | null;
  hasServices: boolean;
  hasProducts: boolean;
  hasBooking: boolean;
}

export function BusinessHeader({
  orgName,
  orgSlug,
  logoUrl,
  hasServices,
  hasProducts,
  hasBooking,
}: BusinessHeaderProps) {
  const t = useTranslations('landing.nav');

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-salon-border bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo and Name */}
          <div className="flex items-center gap-3">
            {logoUrl && (
              <img
                src={logoUrl}
                alt=""
                className="h-12 w-12 rounded-2xl object-cover shadow-sm"
              />
            )}
            <span className="font-serif text-xl font-semibold tracking-tight text-salon-dark">
              {orgName}
            </span>
          </div>

          {/* Navigation */}
          <nav className="hidden items-center gap-8 md:flex">
            <button
              onClick={() => scrollToSection('hero')}
              className="text-sm font-medium uppercase tracking-wide text-salon-text-muted transition-colors hover:text-salon-primary"
            >
              {t('home')}
            </button>

            {hasServices && (
              <button
                onClick={() => scrollToSection('services')}
                className="text-sm font-medium uppercase tracking-wide text-salon-text-muted transition-colors hover:text-salon-primary"
              >
                {t('services')}
              </button>
            )}

            {hasProducts && (
              <button
                onClick={() => scrollToSection('products')}
                className="text-sm font-medium uppercase tracking-wide text-salon-text-muted transition-colors hover:text-salon-primary"
              >
                {t('products')}
              </button>
            )}

            {hasBooking && (
              <Button
                asChild
                className="rounded-full bg-salon-primary px-8 text-white shadow-sm hover:bg-salon-rose"
              >
                <Link href={`/${orgSlug}/book`}>
                  {t('bookNow')}
                </Link>
              </Button>
            )}
          </nav>

          {/* Mobile CTA */}
          {hasBooking && (
            <div className="md:hidden">
              <Button
                asChild
                size="sm"
                className="rounded-full bg-salon-primary px-6 text-white shadow-sm hover:bg-salon-rose"
              >
                <Link href={`/${orgSlug}/book`}>
                  {t('bookNow')}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
