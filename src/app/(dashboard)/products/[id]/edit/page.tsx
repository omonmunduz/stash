/**
 * EDIT PRODUCT PAGE
 *
 * Guarded at manager and above, matching products_update_manager_or_above and the
 * check inside updateProductAction.
 *
 * The form deliberately has no stock field on edit — quantity moves through
 * inventory adjustments, which keep an audit trail. See ProductForm.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProductForm } from '@/features/products/components/ProductForm';
import { getProductService } from '@/features/products/server';
import { requireMinimumRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import { brandId } from '@/lib/types/common';

export const metadata = {
  title: 'Edit product',
};

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;

  await requireMinimumRole('manager');

  const { service } = await getProductService();
  const result = await service.getById(brandId<'ProductId'>(id));

  if (!result.success) notFound();

  const product = result.data;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.products.list}>
          <ArrowLeft aria-hidden="true" />
          Products
        </Link>
      </Button>

      <PageHeader title="Edit product" description={product.sku} />

      <Card>
        <CardContent className="pt-6">
          <ProductForm product={product} />
        </CardContent>
      </Card>
    </div>
  );
}
