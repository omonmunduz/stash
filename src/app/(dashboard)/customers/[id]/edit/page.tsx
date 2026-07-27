/**
 * EDIT CUSTOMER PAGE
 *
 * Guarded at manager and above, matching the customers_update RLS policy and
 * the check inside updateCustomerAction. Guarding here too means an employee
 * following a link lands on the customer list rather than filling in a form that
 * will be rejected on submit.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CustomerForm } from '@/features/customers/components/CustomerForm';
import { getCustomerService } from '@/features/customers/server';
import { requireMinimumRole } from '@/features/auth/guards';
import { getCustomerDisplayName } from '@/features/customers/business-rules';
import { ROUTES } from '@/lib/constants/routes';
import { brandId } from '@/lib/types/common';

export const metadata = {
  title: 'Edit customer',
};

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params;

  await requireMinimumRole('manager');

  const { service } = await getCustomerService();
  const result = await service.getById(brandId<'CustomerId'>(id));

  if (!result.success) notFound();

  const customer = result.data;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.customers.detail(customer.id)}>
          <ArrowLeft aria-hidden="true" />
          {getCustomerDisplayName(customer)}
        </Link>
      </Button>

      <PageHeader
        title="Edit customer"
        description={customer.customer_code}
      />

      <Card>
        <CardContent className="pt-6">
          <CustomerForm customer={customer} />
        </CardContent>
      </Card>
    </div>
  );
}
