/**
 * CUSTOMER DETAIL PAGE
 *
 * One customer: what they owe, what they bought, what they paid.
 *
 * The balance is the first thing on the page because it is the reason anyone
 * opens this screen — usually with the customer standing in front of them.
 */

import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, MapPin, Pencil, Phone } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CreditSummary } from '@/features/customers/components/CustomerBalance';
import { CustomerActions } from '@/features/customers/components/CustomerActions';
import {
  CustomerPaymentsHistory,
  CustomerSalesHistory,
} from '@/features/customers/components/CustomerHistory';
import { RecordPaymentForm } from '@/features/payments/components/RecordPaymentForm';
import { toPickerProducts } from '@/features/sales/picker-products';
import { getCustomerService } from '@/features/customers/server';
import { getProductService } from '@/features/products/server';
import { getCustomerHistory } from '@/features/customers/history';
import { getCustomerDisplayName } from '@/features/customers/business-rules';
import { hasRole } from '@/features/auth/guards';
import { getCreditStanding } from '@/features/customers/components/CustomerBalance';
import { ROUTES } from '@/lib/constants/routes';
import { formatDate, formatMoney } from '@/lib/utils/format';
import { brandId } from '@/lib/types/common';

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * One customer fetch shared by generateMetadata and the page body.
 *
 * Next runs generateMetadata alongside the page render for the same request, so
 * without cache() the identical getById query went out twice — and the service
 * factory resolved auth twice on top of it.
 */
const loadCustomer = cache(async (id: string) => {
  const { service, user } = await getCustomerService();
  const result = await service.getById(brandId<'CustomerId'>(id));
  return { result, user };
});

export async function generateMetadata({ params }: CustomerDetailPageProps) {
  const { id } = await params;
  const { result } = await loadCustomer(id);

  return {
    title: result.success ? getCustomerDisplayName(result.data) : 'Customer',
  };
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;
  const { result, user } = await loadCustomer(id);

  // getById already scopes to the caller's organization, so a cross-tenant or
  // deleted ID lands here rather than leaking that the record exists.
  if (!result.success) notFound();

  const customer = result.data;

  const canEdit = hasRole(user, 'manager');
  const canDelete = hasRole(user, 'admin');

  // The catalog is only needed for the product picker inside the line editor, so
  // managers and above are the only ones who pay for the query. Loaded alongside
  // the history rather than after it — they are independent reads, and the page
  // cannot render until both are in.
  const [history, productsResult] = await Promise.all([
    getCustomerHistory(user.organizationId, customer.id),
    canEdit ? getProductService().then(({ service }) => service.list()) : null,
  ]);

  const products =
    productsResult?.success === true ? toPickerProducts(productsResult.data) : [];

  const standing = getCreditStanding(customer);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.customers.list}>
          <ArrowLeft aria-hidden="true" />
          Customers
        </Link>
      </Button>

      <PageHeader
        title={getCustomerDisplayName(customer)}
        description={customer.customer_code}
        action={
          canEdit ? (
            <Button asChild variant="outline">
              <Link href={ROUTES.customers.edit(customer.id)}>
                <Pencil aria-hidden="true" />
                Edit
              </Link>
            </Button>
          ) : undefined
        }
      />

      {!customer.is_active && (
        <Alert>
          <AlertDescription>
            This customer is deactivated — they will not appear in customer lists
            and new sales to them are blocked. Their balance and history are
            unchanged.
          </AlertDescription>
        </Alert>
      )}

      {history.partialFailure && (
        <Alert variant="destructive">
          <AlertDescription>
            Some history could not be loaded, so the lists below may be
            incomplete. Refresh to try again.
          </AlertDescription>
        </Alert>
      )}

      {/* Balance first — the reason this page gets opened. */}
      <Card>
        <CardHeader className="pb-3">
          <CardDescription>Currently owes</CardDescription>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={
                standing === 'over_limit'
                  ? 'text-3xl font-semibold tabular-nums text-destructive'
                  : 'text-3xl font-semibold tabular-nums'
              }
            >
              {formatMoney(customer.current_balance)}
            </span>
            {standing === 'over_limit' && <Badge variant="destructive">Over limit</Badge>}
            {standing === 'near_limit' && <Badge variant="warning">Near limit</Badge>}
            {standing === 'settled' && <Badge variant="success">Settled up</Badge>}
            {standing === 'in_credit' && <Badge variant="secondary">In credit</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CreditSummary customer={customer} />
          <CustomerActions customer={customer} canEdit={canEdit} canDelete={canDelete} />
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {customer.business_name && (
              <p className="text-muted-foreground">
                Contact name: <span className="text-foreground">{customer.name}</span>
              </p>
            )}

            {customer.phone ? (
              <p className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {/* tel: link so a phone user can call from the record they are
                    looking at, which is the common case for chasing a debt. */}
                <a href={`tel:${customer.phone}`} className="hover:underline">
                  {customer.phone}
                </a>
              </p>
            ) : (
              <p className="text-muted-foreground">No phone number on file</p>
            )}

            {customer.email && (
              <p className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <a href={`mailto:${customer.email}`} className="break-all hover:underline">
                  {customer.email}
                </a>
              </p>
            )}

            {(customer.address || customer.city) && (
              <p className="flex items-start gap-2">
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{[customer.address, customer.city].filter(Boolean).join(', ')}</span>
              </p>
            )}

            <p className="pt-1 text-xs text-muted-foreground">
              Customer since {formatDate(customer.created_at)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {customer.notes ? (
              // whitespace-pre-line so line breaks the user typed survive.
              <p className="whitespace-pre-line text-sm">{customer.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing noted. Use notes for delivery days, who to ask for, or
                payment habits.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recording money received sits above the history: it is the action, and
          the tables below it are the evidence. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Take a payment</CardTitle>
          <CardDescription>
            Applied to their oldest unpaid invoice first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecordPaymentForm
            customerId={customer.id}
            currentBalance={customer.current_balance}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What they took</CardTitle>
          <CardDescription>
            Newest first. Open a row to see the products on it
            {canEdit ? ' and correct anything that was written down wrong.' : '.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0 sm:px-0">
          <CustomerSalesHistory
            sales={history.sales}
            customerId={customer.id}
            products={products}
            canEdit={canEdit}
            canDelete={canDelete}
            itemsUnavailable={history.itemsUnavailable}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments</CardTitle>
          <CardDescription>Money received from this customer.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0 sm:px-0">
          <CustomerPaymentsHistory
            payments={history.payments}
            customerId={customer.id}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
