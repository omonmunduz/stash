'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface BookingCTAProps {
  orgName: string;
  orgSlug: string;
}

export function BookingCTA({ orgName, orgSlug }: BookingCTAProps) {
  const t = useTranslations('landing.cta');

  return (
    <section className="bg-gradient-to-br from-salon-rose to-salon-blush py-20 md:py-28 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white/40 px-8 py-16 backdrop-blur-sm md:px-12">
          <h2 className="mb-4 font-serif text-4xl font-bold tracking-tight text-salon-dark md:text-5xl">
            {t('title')}
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-salon-dark/80 md:text-xl">
            {t('subtitle', { orgName })}
          </p>
          <Button
            asChild
            size="lg"
            className="rounded-full bg-white px-10 text-salon-primary shadow-lg hover:bg-salon-cream"
          >
            <Link href={`/${orgSlug}/book`}>
              {t('bookAppointment')}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
