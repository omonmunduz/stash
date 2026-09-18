import { ProductCard } from './ProductCard';

interface Product {
  id: string;
  name: string;
  description: string | null;
  sale_price: number | null;
  unit_of_measure: string | null;
}

interface ProductsSectionProps {
  products: Product[];
  orgSlug: string;
}

export function ProductsSection({ products, orgSlug }: ProductsSectionProps) {
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
    <section id="products" className="scroll-mt-16 bg-slate-50 py-20 md:py-28 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            Our Products
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-600 md:text-xl">
            Browse our selection
          </p>
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
