'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function CTASection() {
  const t = useTranslations('marketing.home.cta');

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background p-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            {t('title')}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground md:text-xl">
            {t('subtitle')}
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="min-w-[200px]">
              <Link href="/signup">
                {t('button')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
