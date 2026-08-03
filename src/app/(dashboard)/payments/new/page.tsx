/**
 * RECORD PAYMENT PAGE
 *
 * Open to every role, matching payments_insert_any_role and the record-sale page.
 * Whoever is at the counter when a customer settles up has to be able to write it
 * down; the supervised operations are correcting and voiding afterwards.
 *
 * This is the entry point for "someone walked in and handed me money" — you know
 * who paid but you were not already on their page. Paying from a customer's own
 * screen still uses the inline form there, which needs no customer picker.
 */

import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RecordPaymentForm } from '@/features/payments/components/RecordPaymentForm';
import { getCustomerService } from '@/features/customers/server';
import { ROUTES } from '@/lib/constants/routes';

export const metadata = {
  title: 'Record payment',
};

interface NewPaymentPageProps {
  /** ?customer=<id> preselects, for arriving from a customer's page. */
  searchParams: Promise<{ customer?: string }>;
}

export default async function NewPaymentPage({ searchParams }: NewPaymentPageProps) {
  const params = await searchParams;

  // Active only. Money from a deactivated customer is a correction to old
  // business, not a routine handover, and offering them here would suggest the
  // account is still trading.
  const { service } = await getCustomerService();
  const result = await service.list({ status: 'active' });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.payments.list}>
          <ArrowLeft aria-hidden="true" />
          Payments
        </Link>
      </Button>

      <PageHeader
        title="Record a payment"
        description="Money received. It comes off their oldest unpaid invoice first."
      />

      {!result.success ? (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : result.data.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="A payment needs someone it came from. Add a customer first."
          icon={<Users className="size-6" aria-hidden="true" />}
          action={
            <Button asChild>
              <Link href={ROUTES.customers.new}>Add a customer</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            {/* defaultOpen because the whole page is the form — there is nothing
                for a trigger button to reveal. */}
            <RecordPaymentForm
              customers={result.data.map((customer) => ({
                id: customer.id,
                name: customer.name,
                business_name: customer.business_name,
                customer_code: customer.customer_code,
                current_balance: customer.current_balance,
              }))}
              defaultCustomerId={params.customer}
              defaultOpen
              redirectTo={ROUTES.payments.list}
              cancelHref={ROUTES.payments.list}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
