'use client';

import { useTranslations } from 'next-intl';
import { Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MARKETING_CONFIG } from '@/config/marketing';

export function PublicPageSection() {
  const t = useTranslations('marketing.home.publicPage');

  return (
    <section className="bg-muted/30 py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
          {/* Content */}
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t('title')}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {t('description')}
            </p>

            <ul className="mt-8 space-y-4">
              <li className="flex items-start">
                <Check className="mr-3 mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                <span>{t('features.0')}</span>
              </li>
              <li className="flex items-start">
                <Check className="mr-3 mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                <span>{t('features.1')}</span>
              </li>
              <li className="flex items-start">
                <Check className="mr-3 mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                <span>{t('features.2')}</span>
              </li>
              <li className="flex items-start">
                <Check className="mr-3 mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                <span>{t('features.3')}</span>
              </li>
              <li className="flex items-start">
                <Check className="mr-3 mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                <span>{t('features.4')}</span>
              </li>
            </ul>

            {MARKETING_CONFIG.demoBusinessSlug && (
              <div className="mt-8">
                <Button variant="outline" asChild>
                  <a
                    href={`/${MARKETING_CONFIG.demoBusinessSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('example')}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            )}
          </div>

          {/* Visual - Mockup of public page */}
          <div className="rounded-lg border bg-card p-4 shadow-xl">
            <div className="mb-2 flex items-center space-x-2 rounded-t-lg border-b bg-muted px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
              <div className="h-2 w-2 rounded-full bg-green-500" />
            </div>
            <div className="space-y-4 p-4">
              {/* Header mockup */}
              <div className="h-8 w-32 rounded bg-primary/20" />
              {/* Services mockup */}
              <div className="space-y-2">
                <div className="h-20 rounded-lg border bg-background p-3">
                  <div className="mb-2 h-4 w-24 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted/60" />
                </div>
                <div className="h-20 rounded-lg border bg-background p-3">
                  <div className="mb-2 h-4 w-24 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted/60" />
                </div>
              </div>
              {/* CTA mockup */}
              <div className="h-10 w-full rounded-lg bg-primary/20" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
