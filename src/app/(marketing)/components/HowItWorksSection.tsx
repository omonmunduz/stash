'use client';

import { useTranslations } from 'next-intl';
import { UserPlus, Settings, Share2, CheckCircle } from 'lucide-react';

export function HowItWorksSection() {
  const t = useTranslations('marketing.home.howItWorks');

  const steps = [
    {
      icon: UserPlus,
      titleKey: 'step1.title',
      descriptionKey: 'step1.description',
    },
    {
      icon: Settings,
      titleKey: 'step2.title',
      descriptionKey: 'step2.description',
    },
    {
      icon: Share2,
      titleKey: 'step3.title',
      descriptionKey: 'step3.description',
    },
    {
      icon: CheckCircle,
      titleKey: 'step4.title',
      descriptionKey: 'step4.description',
    },
  ];

  return (
    <section id="how-it-works" className="scroll-mt-16 py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            {t('title')}
          </h2>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="relative">
                {/* Connector line (hidden on mobile, shown on md+) */}
                {index < steps.length - 1 && (
                  <div
                    className="absolute left-1/2 top-12 hidden h-0.5 w-full bg-gradient-to-r from-primary/40 to-transparent md:block"
                    style={{ transform: 'translateX(0)' }}
                  />
                )}

                {/* Step card */}
                <div className="relative rounded-lg border bg-card p-6 text-center">
                  {/* Step number */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
                    {index + 1}
                  </div>

                  <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-primary/10 p-4">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>

                  <h3 className="mb-2 text-lg font-semibold">
                    {t(step.titleKey)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t(step.descriptionKey)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
