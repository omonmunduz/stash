'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLocale } from 'next-intl';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description: string | null;
    sale_price: number | null;
    unit_of_measure: string | null;
    image_url: string | null;
    imageSignedUrl: string | null;
  };
  orgSlug: string;
}

export function ProductCard({ product, orgSlug }: ProductCardProps) {
  const locale = useLocale();

  const formatPrice = (price: number | null) => {
    if (price === null) return null;
    return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  return (
    <Link href={`/${orgSlug}/products/${product.id}`}>
      <article className="group flex flex-col overflow-hidden rounded-3xl border border-salon-border bg-white shadow-sm transition-all hover:shadow-xl cursor-pointer">
        {product.imageSignedUrl ? (
          <div className="relative aspect-video w-full overflow-hidden bg-salon-cream">
            <Image
              src={product.imageSignedUrl}
              alt={product.name}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>
        ) : (
          <div className="aspect-video w-full bg-gradient-to-br from-salon-blush to-salon-cream" />
        )}

        <div className="flex flex-1 flex-col p-6 lg:p-8">
          <h3 className="mb-3 font-serif text-2xl font-semibold tracking-tight text-salon-dark">
            {product.name}
          </h3>

          {product.description && (
            <p className="mb-6 flex-1 text-base leading-relaxed text-salon-text-muted line-clamp-3">
              {product.description}
            </p>
          )}

          <div className="mt-auto space-y-3">
            {product.sale_price !== null && (
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl font-bold text-salon-dark">
                  {formatPrice(product.sale_price)}
                </span>
                {product.unit_of_measure && (
                  <span className="text-sm text-salon-text-muted">
                    / {product.unit_of_measure}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
