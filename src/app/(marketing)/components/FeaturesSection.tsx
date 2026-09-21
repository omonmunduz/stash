'use client';

import { useTranslations } from 'next-intl';
import {
  ShoppingBag,
  Users,
  Calendar,
  UserCheck,
  CreditCard,
  Package,
  Receipt,
  BarChart3,
} from 'lucide-react';

export function FeaturesSection() {
  const t = useTranslations('marketing.home.features');

  const features = [
    {
      icon: ShoppingBag,
      titleKey: 'services.title',
      descriptionKey: 'services.description',
    },
    {
      icon: Users,
      titleKey: 'customers.title',
      descriptionKey: 'customers.description',
    },
    {
      icon: Calendar,
      titleKey: 'appointments.title',
      descriptionKey: 'appointments.description',
    },
    {
      icon: UserCheck,
      titleKey: 'employees.title',
      descriptionKey: 'employees.description',
    },
    {
      icon: CreditCard,
      titleKey: 'payments.title',
      descriptionKey: 'payments.description',
    },
    {
      icon: Package,
      titleKey: 'inventory.title',
      descriptionKey: 'inventory.description',
    },
    {
      icon: Receipt,
      titleKey: 'expenses.title',
      descriptionKey: 'expenses.description',
    },
    {
      icon: BarChart3,
      titleKey: 'reports.title',
      descriptionKey: 'reports.description',
    },
  ];

  return (
    <section id="features" className="scroll-mt-16 py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            {t('title')}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground md:text-xl">
            {t('subtitle')}
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-lg"
              >
                <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  {t(feature.titleKey)}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t(feature.descriptionKey)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
