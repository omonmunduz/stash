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
import { getTranslations } from 'next-intl/server';
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
  const t = await getTranslations('products');

  const search = params.q?.trim() || undefined;
  const status = params.status === 'all' ? 'all' : 'active';

  const result = await service.list({ search, status });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <Button asChild>
            <Link href={ROUTES.products.new}>
              <Plus aria-hidden="true" />
              {t('addProduct')}
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
            title={t('list.noMatch.title')}
            description={t('list.noMatch.description')}
            icon={<Package className="size-6" aria-hidden="true" />}
          />
        ) : (
          <EmptyState
            title={t('list.empty.title')}
            description={t('list.empty.description')}
            icon={<Package className="size-6" aria-hidden="true" />}
            action={
              <Button asChild>
                <Link href={ROUTES.products.new}>
                  <Plus aria-hidden="true" />
                  {t('addFirstProduct')}
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t('list.count', { count: result.data.length })}
          </p>
          <ProductList products={result.data} />
        </>
      )}
    </div>
  );
}
