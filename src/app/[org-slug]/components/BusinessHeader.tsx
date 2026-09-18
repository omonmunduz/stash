/**
 * BUSINESS HEADER
 *
 * Dynamic header for public landing page.
 * Navigation adapts based on available services/products.
 */

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

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
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-900 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and Name */}
          <div className="flex items-center gap-3">
            {logoUrl && (
              <img
                src={logoUrl}
                alt=""
                className="h-10 w-10 rounded-lg object-cover"
              />
            )}
            <span className="text-lg font-semibold tracking-tight text-white">
              {orgName}
            </span>
          </div>

          {/* Navigation */}
          <nav className="hidden items-center gap-6 md:flex">
            <button
              onClick={() => scrollToSection('hero')}
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              Home
            </button>

            {hasServices && (
              <button
                onClick={() => scrollToSection('services')}
                className="text-sm font-medium text-white/70 transition-colors hover:text-white"
              >
                Services
              </button>
            )}

            {hasProducts && (
              <button
                onClick={() => scrollToSection('products')}
                className="text-sm font-medium text-white/70 transition-colors hover:text-white"
              >
                Products
              </button>
            )}

            {hasBooking && (
              <Button asChild size="sm" className="bg-white text-slate-900 hover:bg-white/90">
                <Link href={`/${orgSlug}/book`}>
                  Book Now
                </Link>
              </Button>
            )}
          </nav>

          {/* Mobile CTA */}
          {hasBooking && (
            <div className="md:hidden">
              <Button asChild size="sm" className="bg-white text-slate-900 hover:bg-white/90">
                <Link href={`/${orgSlug}/book`}>
                  Book Now
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

