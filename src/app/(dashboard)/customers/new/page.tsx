/**
 * ADD CUSTOMER PAGE
 *
 * No role guard: any signed-in member of the organization may add a customer,
 * matching the customers_insert RLS policy. An employee taking an order needs to
 * enter a new buyer without waiting for a manager.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CustomerForm } from '@/features/customers/components/CustomerForm';
import { requireActiveUser } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';

export const metadata = {
  title: 'Add customer',
};

export default async function NewCustomerPage() {
  // The layout guards this route group, but pages that mutate should not rely on
  // a layout that does not re-run on client-side navigation.
  await requireActiveUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.customers.list}>
          <ArrowLeft aria-hidden="true" />
          Customers
        </Link>
      </Button>

      <PageHeader
        title="Add customer"
        description="Only a name is required. Everything else can wait."
      />

      <Card>
        <CardContent className="pt-6">
          <CustomerForm />
        </CardContent>
      </Card>
    </div>
  );
}
