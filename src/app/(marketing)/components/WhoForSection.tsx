'use client';

import { useTranslations } from 'next-intl';
import { Scissors, Stethoscope, Store, Briefcase } from 'lucide-react';

export function WhoForSection() {
  const t = useTranslations('marketing.home.whoFor');

  const businesses = [
    { icon: Scissors, labelKey: 'salons' },
    { icon: Stethoscope, labelKey: 'clinics' },
    { icon: Store, labelKey: 'shops' },
    { icon: Briefcase, labelKey: 'services' },
  ];

  return (
    <section className="bg-muted/30 py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t('title')}
          </h2>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {businesses.map((business, index) => {
              const Icon = business.icon;
              return (
                <div
                  key={index}
                  className="rounded-lg border bg-card p-6 text-center transition-all hover:border-primary hover:shadow-lg"
                >
                  <div className="mb-4 inline-flex items-center justify-center rounded-full bg-primary/10 p-4">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  <p className="font-medium">{t(business.labelKey)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
