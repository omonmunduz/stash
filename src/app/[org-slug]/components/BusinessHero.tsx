'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface BusinessHeroProps {
  orgName: string;
  landingPageTitle: string | null;
  description: string | null;
  heroImageUrl: string | null;
  hasServices: boolean;
  hasProducts: boolean;
  orgSlug: string;
}

export function BusinessHero({
  orgName,
  landingPageTitle,
  description,
  heroImageUrl,
  hasServices,
  hasProducts,
  orgSlug,
}: BusinessHeroProps) {
  const t = useTranslations('landing.hero');

  const getMessage = () => {
    if (hasServices && hasProducts) {
      return t('exploreServicesAndProducts');
    }
    if (hasServices) {
      return t('bookAppointmentToday');
    }
    if (hasProducts) {
      return t('discoverProducts');
    }
    return null;
  };

  const message = getMessage();

  return (
    <section id="hero" className="scroll-mt-20 bg-salon-cream py-20 md:py-28 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20">
          {/* Left Column - Content */}
          <div className="flex flex-col justify-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-salon-text-muted">
              {t('home')}
            </p>

            <h1 className="mb-6 font-serif text-5xl font-bold leading-tight tracking-tight text-salon-dark md:text-6xl lg:text-7xl">
              {(landingPageTitle || orgName).split(' ').slice(0, -1).join(' ')}{' '}
              <span className="italic text-salon-rose">
                {(landingPageTitle || orgName).split(' ').slice(-1)[0]}
              </span>
            </h1>

            {(description || message) && (
              <p className="mb-8 text-lg leading-relaxed text-salon-text-muted md:text-xl">
                {description || message}
              </p>
            )}

            <div className="mb-10 flex flex-col items-start gap-4 sm:flex-row">
              {hasServices && (
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-salon-primary px-8 text-white shadow-sm hover:bg-salon-rose"
                >
                  <Link href={`/${orgSlug}/book`}>{t('bookNow')}</Link>
                </Button>
              )}

              {hasProducts && (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full border-2 border-salon-primary bg-transparent px-8 text-salon-primary hover:bg-salon-primary hover:text-white"
                >
                  <Link href="#products">{t('viewProducts')}</Link>
                </Button>
              )}
            </div>
          </div>

          {/* Right Column - Image */}
          <div className="relative flex items-center justify-center">
            {heroImageUrl ? (
              <div className="relative h-[400px] w-full overflow-hidden rounded-3xl shadow-2xl lg:h-[500px] xl:h-[600px]">
                <img
                  src={heroImageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-salon-blush/10 to-transparent" />
              </div>
            ) : (
              <div className="flex h-[400px] w-full items-center justify-center rounded-3xl bg-gradient-to-br from-salon-blush to-white shadow-xl lg:h-[500px] xl:h-[600px]">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-24 w-24 rounded-full bg-white shadow-sm" />
                  <p className="font-serif text-2xl font-semibold text-salon-primary">
                    {orgName}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
