/**
 * ADD PRODUCT PAGE
 *
 * Manager or above, matching products_insert_manager_or_above: pricing drives
 * every profit figure in the app, so it is not an employee-level edit.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.products.list}>
          <ArrowLeft aria-hidden="true" />
          Products
        </Link>
      </Button>

      <PageHeader
        title="Add product"
        description="Name, what it costs you, and what you charge."
      />

      <Card>
        <CardContent className="pt-6">
          <ProductForm />
        </CardContent>
      </Card>
    </div>
  );
}
