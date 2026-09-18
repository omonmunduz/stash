import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface BusinessHeroProps {
  orgName: string;
  description: string | null;
  heroImageUrl: string | null;
  hasServices: boolean;
  hasProducts: boolean;
  orgSlug: string;
}

export function BusinessHero({
  orgName,
  description,
  heroImageUrl,
  hasServices,
  hasProducts,
  orgSlug,
}: BusinessHeroProps) {
  const getMessage = () => {
    if (hasServices && hasProducts) {
      return 'Explore our services and products';
    }
    if (hasServices) {
      return 'Book your appointment today';
    }
    if (hasProducts) {
      return 'Discover our products';
    }
    return null;
  };

  const message = getMessage();

  return (
    <section id="hero" className="scroll-mt-16">
      <div
        className={`relative ${
          heroImageUrl
            ? 'h-[500px] md:h-[600px] lg:h-[700px]'
            : 'bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 py-24 md:py-32 lg:py-40'
        }`}
      >
        {heroImageUrl && (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${heroImageUrl})` }}
              role="img"
              aria-label={`${orgName} hero image`}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />
          </>
        )}

        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className={`mx-auto max-w-4xl text-center ${
              heroImageUrl
                ? 'flex h-[500px] flex-col justify-center text-white md:h-[600px] lg:h-[700px]'
                : 'text-foreground'
            }`}
          >
            <h1
              className={`mb-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl ${
                heroImageUrl ? 'drop-shadow-2xl' : ''
              }`}
            >
              {orgName}
            </h1>

            {description && (
              <p
                className={`mb-8 text-xl md:text-2xl lg:text-3xl ${
                  heroImageUrl ? 'drop-shadow-lg' : 'text-foreground/70'
                }`}
              >
                {description}
              </p>
            )}

            {message && (
              <p
                className={`mb-10 text-lg md:text-xl ${
                  heroImageUrl ? 'drop-shadow-md' : 'text-foreground/60'
                }`}
              >
                {message}
              </p>
            )}

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              {hasServices && (
                <Button
                  asChild
                  size="lg"
                  className={`min-w-[160px] text-base ${
                    heroImageUrl
                      ? 'bg-white text-slate-900 hover:bg-white/90'
                      : ''
                  }`}
                >
                  <Link href={`/${orgSlug}/book`}>Book Now</Link>
                </Button>
              )}

              {hasProducts && (
                <Button
                  asChild
                  size="lg"
                  variant={hasServices ? 'outline' : 'default'}
                  className={`min-w-[160px] text-base ${
                    heroImageUrl && hasServices
                      ? 'border-white bg-transparent text-white hover:bg-white/10'
                      : heroImageUrl
                        ? 'bg-white text-slate-900 hover:bg-white/90'
                        : ''
                  }`}
                >
                  <Link href="#products">View Products</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
