import Image from 'next/image';

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

export function ProductCard({ product }: ProductCardProps) {
  const formatPrice = (price: number | null) => {
    if (price === null) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-slate-300">
      {product.imageSignedUrl && (
        <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
          <Image
            src={product.imageSignedUrl}
            alt={product.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-6 lg:p-8">
        <h3 className="mb-3 text-2xl font-semibold tracking-tight text-slate-900">
          {product.name}
        </h3>

        {product.description && (
          <p className="mb-6 flex-1 text-base leading-relaxed text-slate-600 line-clamp-3">
            {product.description}
          </p>
        )}

        <div className="mt-auto space-y-3">
          {product.sale_price !== null && (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900">
                {formatPrice(product.sale_price)}
              </span>
              {product.unit_of_measure && (
                <span className="text-sm text-slate-500">
                  / {product.unit_of_measure}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
