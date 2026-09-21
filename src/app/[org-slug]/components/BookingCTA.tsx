'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BookingCTAProps {
  orgName: string;
  orgSlug: string;
}

export function BookingCTA({ orgName, orgSlug }: BookingCTAProps) {
  const t = useTranslations('landing.cta');

  return (
    <section className="bg-slate-900 py-20 text-white md:py-28 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
          {t('title')}
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-white/80 md:text-xl">
          {t('subtitle', { orgName })}
        </p>
        <Button asChild size="lg" className="bg-white text-slate-900 hover:bg-white/90">
          <Link href={`/${orgSlug}/book`}>
            <Calendar className="mr-2 h-5 w-5" aria-hidden="true" />
            {t('bookAppointment')}
          </Link>
        </Button>
      </div>
    </section>
  );
}
