interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description: string | null;
    sale_price: number | null;
    unit_of_measure: string | null;
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
