'use client';

import { useTranslations } from 'next-intl';
import { X, Check } from 'lucide-react';

export function ProblemSolutionSection() {
  const t = useTranslations('marketing.home.problem');

  return (
    <section className="bg-muted/30 py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t('title')}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t('description')}
          </p>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {/* Before */}
            <div className="rounded-lg border bg-background p-6">
              <div className="mb-4 inline-flex items-center justify-center rounded-full bg-destructive/10 p-2">
                <X className="h-5 w-5 text-destructive" />
              </div>
              <h3 className="mb-4 text-xl font-semibold">{t('before')}</h3>
              <ul className="space-y-3 text-left">
                <li className="flex items-start">
                  <span className="mr-2 mt-1 text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{t('beforeItems.0')}</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 mt-1 text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{t('beforeItems.1')}</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 mt-1 text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{t('beforeItems.2')}</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 mt-1 text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{t('beforeItems.3')}</span>
                </li>
              </ul>
            </div>

            {/* After */}
            <div className="rounded-lg border-2 border-primary bg-background p-6">
              <div className="mb-4 inline-flex items-center justify-center rounded-full bg-primary/10 p-2">
                <Check className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-4 text-xl font-semibold">{t('after')}</h3>
              <ul className="space-y-3 text-left">
                <li className="flex items-start">
                  <Check className="mr-2 mt-1 h-4 w-4 text-primary" />
                  <span>{t('afterItems.0')}</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 mt-1 h-4 w-4 text-primary" />
                  <span>{t('afterItems.1')}</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 mt-1 h-4 w-4 text-primary" />
                  <span>{t('afterItems.2')}</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 mt-1 h-4 w-4 text-primary" />
                  <span>{t('afterItems.3')}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
