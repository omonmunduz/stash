'use client';

import { useTranslations } from 'next-intl';
import { ServiceCard } from './ServiceCard';

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  price: number | null;
}

interface ServicesSectionProps {
  services: Service[];
  orgSlug: string;
}

export function ServicesSection({ services, orgSlug }: ServicesSectionProps) {
  const t = useTranslations('landing.services');

  if (services.length === 0) {
    return null;
  }

  return (
    <section id="services" className="scroll-mt-20 bg-white py-20 md:py-28 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-salon-text-muted">
            {t('title')}
          </p>
          <h2 className="mb-4 font-serif text-4xl font-bold tracking-tight text-salon-dark md:text-5xl">
            {t('subtitle')}
          </h2>
        </div>

        <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} orgSlug={orgSlug} />
          ))}
        </div>
      </div>
    </section>
  );
}
