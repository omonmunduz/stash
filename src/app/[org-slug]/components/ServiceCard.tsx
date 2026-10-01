'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Clock } from 'lucide-react';

interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number | null;
    price: number | null;
  };
  orgSlug: string;
}

export function ServiceCard({ service, orgSlug }: ServiceCardProps) {
  const t = useTranslations('landing.services');
  const locale = useLocale();

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null;

    if (minutes < 60) {
      return locale === 'ru' ? `${minutes} мин` : `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return locale === 'ru' ? `${hours} ч` : `${hours} hr`;
    }

    return locale === 'ru'
      ? `${hours} ч ${remainingMinutes} мин`
      : `${hours} hr ${remainingMinutes} min`;
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return null;
    return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  return (
    <Link href={`/${orgSlug}/book?service=${service.id}`}>
      <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-salon-border bg-white shadow-sm transition-all hover:shadow-xl">
        {/* Image placeholder - using gradient since we don't have service images */}
        <div className="relative h-48 overflow-hidden bg-gradient-to-br from-salon-blush to-salon-cream">
          <div className="absolute inset-0 bg-salon-rose/5" />
        </div>

        <div className="flex flex-1 flex-col p-6">
          <h3 className="mb-2 font-serif text-xl font-semibold tracking-tight text-salon-dark">
            {service.name}
          </h3>

          {service.description && (
            <p className="mb-4 flex-1 text-sm leading-relaxed text-salon-text-muted line-clamp-2">
              {service.description}
            </p>
          )}

          <div className="mt-auto space-y-3">
            {service.duration_minutes && (
              <div className="flex items-center gap-2 text-sm text-salon-text-muted">
                <Clock className="h-4 w-4" aria-hidden="true" />
                <span>{formatDuration(service.duration_minutes)}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              {service.price !== null && (
                <div className="font-serif text-2xl font-bold text-salon-dark">
                  {formatPrice(service.price)}
                </div>
              )}

              <div className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-salon-primary text-white shadow-sm transition-transform group-hover:scale-110 group-hover:bg-salon-rose">
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
