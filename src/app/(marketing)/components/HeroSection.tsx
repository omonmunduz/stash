'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function HeroSection() {
  const t = useTranslations('marketing.home.hero');

  const scrollToHowItWorks = () => {
    const element = document.getElementById('how-it-works');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/20 py-20 sm:py-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          {/* Hero Title */}
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            {t('title')}
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl md:text-2xl">
            {t('subtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="min-w-[160px]">
              <Link href="/signup">
                {t('ctaPrimary')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="min-w-[160px]"
              onClick={scrollToHowItWorks}
            >
              {t('ctaSecondary')}
            </Button>
          </div>

          {/* Hero Visual */}
          <div className="mt-16 rounded-lg border bg-card p-1 shadow-2xl">
            <div className="relative aspect-video rounded-md overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-background">
              <Image
                src="/hero-dashboard.png"
                alt="Stash Dashboard"
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
