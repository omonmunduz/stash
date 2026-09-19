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

import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, User } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
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

/**
 * One sale fetch shared by generateMetadata and the page body.
 *
 * Next runs generateMetadata alongside the page render for the same request, so
 * without cache() the identical getWithDetails query — the expensive one, with
 * its embedded items and payments — went out twice.
 */
const loadSale = cache(async (id: string) => {
  const { service, user } = await getSaleService();
  const result = await service.getWithDetails(brandId<'SaleId'>(id));
  return { result, user };
});

export async function generateMetadata({ params }: SaleDetailPageProps) {
  const { id } = await params;
  const { result } = await loadSale(id);

  return {
    title: result.success ? (result.data.sale_number ?? 'Draft sale') : 'Sale',
  };
}

export default async function SaleDetailPage({ params }: SaleDetailPageProps) {
  const { id } = await params;
  const { result, user } = await loadSale(id);
  const t = await getTranslations('sales.detail');

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
          {t('backToSales')}
        </Link>
      </Button>

      <PageHeader
        title={sale.sale_number ?? t('draftSale')}
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
            {t('cancelledAlert', { customerName })}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardDescription>
            {sale.amount_due > 0 ? t('stillOwed') : t('thisSale')}
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
              <Badge variant="secondary">{t('cancelled')}</Badge>
            ) : sale.payment_status === 'paid' ? (
              <Badge variant="success">{t('paid')}</Badge>
            ) : sale.payment_status === 'partial' ? (
              <Badge variant="warning">{t('partPaid')}</Badge>
            ) : (
              <Badge variant="outline">{t('unpaid')}</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">{t('total')}</dt>
              <dd className="font-medium tabular-nums">{formatMoney(sale.total)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('paid')}</dt>
              <dd className="font-medium tabular-nums">{formatMoney(sale.amount_paid)}</dd>
            </div>
            {sale.due_date && (
              <div>
                <dt className="text-muted-foreground">{t('payBy')}</dt>
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
          <CardTitle className="text-base">{t('whatWasOnIt')}</CardTitle>
          <CardDescription>
            {canEdit && !isCancelled
              ? t('whatWasOnItDescriptionEdit')
              : t('whatWasOnItDescription')}
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
            <CardTitle className="text-base">{t('takePayment')}</CardTitle>
            <CardDescription>
              {t('takePaymentDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecordPaymentForm
              customerId={sale.customer_id}
              currentBalance={sale.amount_due}
              saleId={sale.id}
              triggerLabel={t('recordPayment')}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('paymentsAgainstSale')}</CardTitle>
          <CardDescription>
            {t('paymentsAgainstSaleDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sale.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('noPaymentsYet')}
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
