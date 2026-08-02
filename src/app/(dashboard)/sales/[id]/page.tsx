/**
 * SALE DETAIL PAGE
 *
 * One transaction: what was on it, what has been paid against it, and the
 * controls to correct any of that.
 *
 * This is where createSaleAction lands after recording a sale, so it doubles as
 * the receipt view — hence the customer and the amount still due sitting at the
 * top, which is what gets read back to whoever is standing there.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, User } from 'lucide-react';
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
import { SaleLinesEditor } from '@/features/sales/components/SaleLinesEditor';
import { SaleActions } from '@/features/sales/components/SaleActions';
import { RecordPaymentForm } from '@/features/payments/components/RecordPaymentForm';
import { toPickerProducts } from '@/features/sales/picker-products';
import { getSaleService } from '@/features/sales/server';
import { getProductService } from '@/features/products/server';
import { hasRole } from '@/features/auth/guards';
import { PAYMENT_METHOD_LABELS } from '@/features/payments/labels';
import { ROUTES } from '@/lib/constants/routes';
import { formatDate, formatMoney } from '@/lib/utils/format';
import { brandId } from '@/lib/types/common';

interface SaleDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: SaleDetailPageProps) {
  const { id } = await params;
  const { service } = await getSaleService();
  const result = await service.getWithDetails(brandId<'SaleId'>(id));

  return {
    title: result.success ? (result.data.sale_number ?? 'Draft sale') : 'Sale',
  };
}

export default async function SaleDetailPage({ params }: SaleDetailPageProps) {
  const { id } = await params;
  const { service, user } = await getSaleService();

  const result = await service.getWithDetails(brandId<'SaleId'>(id));

  // getWithDetails scopes to the caller's organization, so a cross-tenant or
  // deleted id lands here rather than leaking that the record exists.
  if (!result.success) notFound();

  const sale = result.data;

  const canEdit = hasRole(user, 'manager');
  const canDelete = hasRole(user, 'admin');

  // Only needed for the picker in the line editor, so only loaded for the roles
  // that can use it.
  const productsResult = canEdit
    ? await getProductService().then(({ service: products }) => products.list())
    : null;

  const products =
    productsResult?.success === true ? toPickerProducts(productsResult.data) : [];

  const isCancelled = sale.status === 'cancelled';
  const customerName = sale.customer.business_name ?? sale.customer.name;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.sales.list}>
          <ArrowLeft aria-hidden="true" />
          Sales
        </Link>
      </Button>

      <PageHeader
        title={sale.sale_number ?? 'Draft sale'}
        description={formatDate(sale.sale_date)}
        action={
          <SaleActions
            saleId={sale.id}
            customerId={sale.customer_id}
            status={sale.status}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        }
      />

      {isCancelled && (
        <Alert>
          <AlertDescription>
            This sale was cancelled. The stock went back on the shelf and the debt
            came off {customerName}&apos;s tab. It is kept on record rather than
            deleted, so the invoice number stays accounted for.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardDescription>
            {sale.amount_due > 0 ? 'Still owed on this sale' : 'This sale'}
          </CardDescription>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={
                sale.amount_due > 0
                  ? 'text-3xl font-semibold tabular-nums'
                  : 'text-3xl font-semibold tabular-nums text-muted-foreground'
              }
            >
              {formatMoney(sale.amount_due > 0 ? sale.amount_due : sale.total)}
            </span>
            {isCancelled ? (
              <Badge variant="secondary">Cancelled</Badge>
            ) : sale.payment_status === 'paid' ? (
              <Badge variant="success">Paid</Badge>
            ) : sale.payment_status === 'partial' ? (
              <Badge variant="warning">Part paid</Badge>
            ) : (
              <Badge variant="outline">Unpaid</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-medium tabular-nums">{formatMoney(sale.total)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Paid</dt>
              <dd className="font-medium tabular-nums">{formatMoney(sale.amount_paid)}</dd>
            </div>
            {sale.due_date && (
              <div>
                <dt className="text-muted-foreground">Pay by</dt>
                <dd className="font-medium">{formatDate(sale.due_date)}</dd>
              </div>
            )}
          </dl>

          <p className="flex items-center gap-2 text-sm">
            <User className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Link
              href={ROUTES.customers.detail(sale.customer_id)}
              className="font-medium hover:underline"
            >
              {customerName}
            </Link>
            <span className="text-muted-foreground tabular-nums">
              {sale.customer.customer_code}
            </span>
          </p>

          {sale.notes && (
            <p className="whitespace-pre-line border-t border-border pt-3 text-sm text-muted-foreground">
              {sale.notes}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What was on it</CardTitle>
          <CardDescription>
            {canEdit && !isCancelled
              ? 'Correct a quantity or price, or add a line that was missed.'
              : 'The products on this sale.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2 sm:px-0">
          <SaleLinesEditor
            saleId={sale.id}
            lines={sale.items.map((item) => ({
              id: item.id,
              product_id: item.product_id,
              product_name: item.product_name,
              product_sku: item.product_sku,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal,
              discount: item.discount,
            }))}
            products={products}
            canEdit={canEdit && !isCancelled}
          />
        </CardContent>
      </Card>

      {!isCancelled && sale.amount_due > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Take a payment</CardTitle>
            <CardDescription>
              Settles this invoice first, then anything left goes to their other
              unpaid invoices oldest-first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecordPaymentForm
              customerId={sale.customer_id}
              currentBalance={sale.amount_due}
              saleId={sale.id}
              triggerLabel="Record a payment"
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments against this sale</CardTitle>
          <CardDescription>
            What each payment put toward this invoice, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sale.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing has been paid against this sale yet.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {sale.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <div>
                    <span className="font-medium tabular-nums">
                      {payment.payment_number}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(payment.payment_date)} ·{' '}
                      {PAYMENT_METHOD_LABELS[payment.payment_method]}
                      {payment.reference_number && ` · ${payment.reference_number}`}
                    </span>
                  </div>
                  {/* The allocated amount, not the payment's full value: one
                      payment can be split across several invoices. */}
                  <span className="shrink-0 font-medium tabular-nums text-emerald-700">
                    {formatMoney(payment.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
