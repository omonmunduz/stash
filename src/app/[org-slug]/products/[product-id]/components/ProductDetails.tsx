'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductDetailsProps {
  product: {
    id: string;
    name: string;
    description: string | null;
    sale_price: number | null;
    unit_of_measure: string | null;
    category: string | null;
    imageSignedUrl: string | null;
  };
  orgSlug: string;
  orgName: string;
}

export function ProductDetails({ product, orgSlug, orgName }: ProductDetailsProps) {
  const locale = useLocale();
  const t = useTranslations('landing.productDetails');

  const formatPrice = (price: number | null) => {
    if (price === null) return null;
    return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  return (
    <main className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
      {/* Back button */}
      <div className="mb-8">
        <Button
          variant="ghost"
          asChild
          className="text-salon-text-muted hover:text-salon-dark"
        >
          <Link href={`/${orgSlug}#products`}>
            <ArrowLeft className="mr-2 size-4" />
            {t('backToProducts')}
          </Link>
        </Button>
      </div>

      {/* Product details */}
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Image section */}
          <div className="overflow-hidden rounded-3xl border border-salon-border bg-white shadow-lg">
            {product.imageSignedUrl ? (
              <div className="relative aspect-square w-full">
                <Image
                  src={product.imageSignedUrl}
                  alt={product.name}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-salon-blush to-salon-cream">
                <Package className="size-24 text-salon-text-muted/30" />
              </div>
            )}
          </div>

          {/* Info section */}
          <div className="flex flex-col">
            {product.category && (
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-salon-text-muted">
                {product.category}
              </p>
            )}

            <h1 className="mb-6 font-serif text-4xl font-bold tracking-tight text-salon-dark md:text-5xl">
              {product.name}
            </h1>

            {product.description && (
              <p className="mb-8 text-lg leading-relaxed text-salon-text-muted whitespace-pre-wrap">
                {product.description}
              </p>
            )}

            {product.sale_price !== null && (
              <div className="mb-8 flex items-baseline gap-3 rounded-2xl border border-salon-border bg-white p-6">
                <span className="font-serif text-5xl font-bold text-salon-dark">
                  {formatPrice(product.sale_price)}
                </span>
                {product.unit_of_measure && (
                  <span className="text-lg text-salon-text-muted">
                    / {product.unit_of_measure}
                  </span>
                )}
              </div>
            )}

            <div className="mt-auto rounded-2xl border border-salon-border bg-salon-blush p-6">
              <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-salon-text-muted">
                {t('availableAt')}
              </p>
              <p className="font-serif text-2xl font-semibold text-salon-dark">
                {orgName}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
