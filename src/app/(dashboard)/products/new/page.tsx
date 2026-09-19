/**
 * ADD PRODUCT PAGE
 *
 * Manager or above, matching products_insert_manager_or_above: pricing drives
 * every profit figure in the app, so it is not an employee-level edit.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProductForm } from '@/features/products/components/ProductForm';
import { requireMinimumRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';

export const metadata = {
  title: 'Add product',
};

export default async function NewProductPage() {
  // Guarding here as well as in the action means an employee following a link
  // lands somewhere useful instead of filling in a form that will be rejected.
  await requireMinimumRole('manager');
  const t = await getTranslations('products.new');

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.products.list}>
          <ArrowLeft aria-hidden="true" />
          {t('backToProducts')}
        </Link>
      </Button>

      <PageHeader
        title={t('title')}
        description={t('description')}
      />

      <Card>
        <CardContent className="pt-6">
          <ProductForm />
        </CardContent>
      </Card>
    </div>
  );
}
