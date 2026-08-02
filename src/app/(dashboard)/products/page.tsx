/**
 * PRODUCT LIST PAGE
 *
 * The catalog. Exists mainly so the sale form has something to pick from, so it
 * is deliberately plain: what you sell, what it costs, what you charge, how many
 * are left.
 *
 * A Server Component — search comes from searchParams and the query runs once
 * per navigation.
 */

import Link from 'next/link';
import { Package, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProductList } from '@/features/products/components/ProductList';
import { getProductService } from '@/features/products/server';
import { ROUTES } from '@/lib/constants/routes';

export const metadata = {
  title: 'Products',
};

interface ProductsPageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const { service } = await getProductService();

  const search = params.q?.trim() || undefined;
  const status = params.status === 'all' ? 'all' : 'active';

  const result = await service.list({ search, status });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Products"
        description="What you sell, and what it costs you."
        action={
          <Button asChild>
            <Link href={ROUTES.products.new}>
              <Plus aria-hidden="true" />
              Add product
            </Link>
          </Button>
        }
      />

      {!result.success ? (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : result.data.length === 0 ? (
        search ? (
          <EmptyState
            title="No products match that search"
            description="Try a different name or product code."
            icon={<Package className="size-6" aria-hidden="true" />}
          />
        ) : (
          <EmptyState
            title="No products yet"
            description="Add what you sell. You need at least one product before you can record a sale."
            icon={<Package className="size-6" aria-hidden="true" />}
            action={
              <Button asChild>
                <Link href={ROUTES.products.new}>
                  <Plus aria-hidden="true" />
                  Add your first product
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {result.data.length} {result.data.length === 1 ? 'product' : 'products'}
          </p>
          <ProductList products={result.data} />
        </>
      )}
    </div>
  );
}
