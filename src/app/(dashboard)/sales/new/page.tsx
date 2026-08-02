/**
 * RECORD SALE PAGE
 *
 * Open to every role. Whoever is behind the counter has to be able to write down
 * what just left the shelf — the same reasoning as sales_insert_any_role. The
 * supervised operations are the corrections afterwards, not the recording.
 *
 * Both lists load here rather than in the form so the form stays a plain client
 * component with no fetching of its own.
 */

import Link from 'next/link';
import { ArrowLeft, Package, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SaleForm } from '@/features/sales/components/SaleForm';
import { toPickerProducts } from '@/features/sales/picker-products';
import { getProductService } from '@/features/products/server';
import { getCustomerService } from '@/features/customers/server';
import { ROUTES } from '@/lib/constants/routes';

export const metadata = {
  title: 'Record sale',
};

interface NewSalePageProps {
  /** ?customer=<id> preselects, for arriving from a customer's page. */
  searchParams: Promise<{ customer?: string }>;
}

export default async function NewSalePage({ searchParams }: NewSalePageProps) {
  const params = await searchParams;

  const [{ service: customerService }, { service: productService }] = await Promise.all([
    getCustomerService(),
    getProductService(),
  ]);

  const [customersResult, productsResult] = await Promise.all([
    customerService.list({ status: 'active' }),
    productService.list({ status: 'active' }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.sales.list}>
          <ArrowLeft aria-hidden="true" />
          Sales
        </Link>
      </Button>

      <PageHeader
        title="Record a sale"
        description="What went out, and what they paid for it now."
      />

      {!customersResult.success ? (
        <Alert variant="destructive">
          <AlertDescription>{customersResult.error}</AlertDescription>
        </Alert>
      ) : !productsResult.success ? (
        <Alert variant="destructive">
          <AlertDescription>{productsResult.error}</AlertDescription>
        </Alert>
      ) : customersResult.data.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="A sale needs someone to sell to. Add a customer first."
          icon={<Users className="size-6" aria-hidden="true" />}
          action={
            <Button asChild>
              <Link href={ROUTES.customers.new}>Add a customer</Link>
            </Button>
          }
        />
      ) : productsResult.data.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="A sale needs something to sell. Add a product first."
          icon={<Package className="size-6" aria-hidden="true" />}
          action={
            <Button asChild>
              <Link href={ROUTES.products.new}>Add a product</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <SaleForm
              customers={customersResult.data.map((customer) => ({
                id: customer.id,
                name: customer.name,
                business_name: customer.business_name,
                customer_code: customer.customer_code,
                current_balance: customer.current_balance,
                credit_limit: customer.credit_limit,
              }))}
              products={toPickerProducts(productsResult.data)}
              defaultCustomerId={params.customer}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
