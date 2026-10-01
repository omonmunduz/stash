'use client';

import { useTranslations } from 'next-intl';
import { ProductCard } from './ProductCard';

interface Product {
  id: string;
  name: string;
  description: string | null;
  sale_price: number | null;
  unit_of_measure: string | null;
  image_url: string | null;
  imageSignedUrl: string | null;
}

interface ProductsSectionProps {
  products: Product[];
  orgSlug: string;
}

export function ProductsSection({ products, orgSlug }: ProductsSectionProps) {
  const t = useTranslations('landing.products');

  if (products.length === 0) {
    return null;
  }

  const gridCols = products.length === 1
    ? 'md:grid-cols-1 lg:max-w-md'
    : products.length === 2
    ? 'md:grid-cols-2 lg:max-w-4xl'
    : products.length === 3
    ? 'md:grid-cols-2 lg:grid-cols-3'
    : 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <section id="products" className="scroll-mt-20 bg-salon-blush py-20 md:py-28 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-salon-text-muted">
            {t('title')}
          </p>
          <h2 className="mb-4 font-serif text-4xl font-bold tracking-tight text-salon-dark md:text-5xl">
            {t('subtitle')}
          </h2>
        </div>

        <div className={`mx-auto grid max-w-7xl gap-8 ${gridCols}`}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} orgSlug={orgSlug} />
          ))}
        </div>
      </div>
    </section>
  );
}
