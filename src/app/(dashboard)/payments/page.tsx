/**
 * PAYMENTS DAY BOOK
 *
 * Money in, newest first. The counterpart to the sales list: that page answers
 * what went out and what is still owed on it, this one answers what actually came
 * back through the door.
 *
 * Defaults to this month rather than everything. A payments list grows faster than
 * a customer list — one row per handover — and the question being asked is nearly
 * always about the recent past. "Everything" is one tap away.
 *
 * Customer names come from a second query rather than a join, the same as the
 * sales list, so the payment repository keeps returning plain Payment rows. That
 * query is issued in parallel with the payment list, not after it.
 */

import Link from 'next/link';
import { Suspense } from 'react';
import { Plus, Wallet } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  PaymentList,
  type CustomerNameMap,
} from '@/features/payments/components/PaymentList';
import { PaymentFilters } from '@/features/payments/components/PaymentFilters';
import {
  DEFAULT_PAYMENT_PERIOD,
  parsePaymentPeriod,
  paymentPeriodStart,
} from '@/features/payments/periods';
import { getPaymentService } from '@/features/payments/server';
import { getCustomerService } from '@/features/customers/server';
import { hasRole } from '@/features/auth/roles';
import { PAYMENT_METHOD_LABELS } from '@/features/payments/labels';
import type { PaymentMethod } from '@/features/payments/types';
import { ROUTES } from '@/lib/constants/routes';
import { formatMoney } from '@/lib/utils/format';

export const metadata = {
  title: 'Payments',
};

interface PaymentsPageProps {
  searchParams: Promise<{ period?: string; method?: string }>;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const params = await searchParams;
  const t = await getTranslations('payments');

  const period = parsePaymentPeriod(params.period);
  const method = parseMethod(params.method);

  // Both factories resolve the same request-memoized auth state, so these run
  // concurrently instead of the second waiting on the first.
  const [{ service, user }, { service: customerService }] = await Promise.all([
    getPaymentService(),
    getCustomerService(),
  ]);

  // Customers are now fetched unconditionally. Skipping them on an empty list
  // saved a round trip in the rare case at the cost of serialising the common
  // one, since the customer query could not start until the payments came back.
  const [result, namesResult] = await Promise.all([
    service.list({
      dateFrom: paymentPeriodStart(period),
      method,
    }),
    // listNames() is deliberately unfiltered by status or deletion, so a payment
    // from a customer since deactivated — or since removed — still shows who paid
    // it. That used to be a `status: 'all'` list read of every column.
    customerService.listNames(),
  ]);

  // Names for the payments actually on the page.
  const customerNames: CustomerNameMap = namesResult.success
    ? namesResult.data
    : new Map();

  // Editing and voiding are manager work, matching payments_update_manager_or_above.
  // Recording is not — the button above is open to everyone.
  const canEdit = hasRole(user, 'manager');

  const isFiltered = period !== DEFAULT_PAYMENT_PERIOD || method !== undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <Button asChild>
            <Link href={ROUTES.payments.new()}>
              <Plus aria-hidden="true" />
              {t('recordPayment')}
            </Link>
          </Button>
        }
      />

      {/* useSearchParams() suspends while prerendering, so the filters need a
          boundary or the whole route is forced dynamic. */}
      <Suspense fallback={null}>
        <PaymentFilters />
      </Suspense>

      {!result.success ? (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : result.data.length === 0 ? (
        isFiltered ? (
          <EmptyState
            title={t('list.noMatch.title')}
            description={t('list.noMatch.description')}
            icon={<Wallet className="size-6" aria-hidden="true" />}
            action={
              <Button asChild variant="outline">
                <Link href={ROUTES.payments.list}>{t('clearFilters')}</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={t('list.empty.title')}
            description={t('list.empty.description')}
            icon={<Wallet className="size-6" aria-hidden="true" />}
            action={
              <Button asChild>
                <Link href={ROUTES.payments.new()}>
                  <Plus aria-hidden="true" />
                  {t('recordAPayment')}
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <ListSummary payments={result.data} />
          <PaymentList
            payments={result.data}
            customerNames={customerNames}
            canEdit={canEdit}
          />
        </>
      )}
    </div>
  );
}

/**
 * Count and total for the current view.
 *
 * Summed from the rows on screen rather than queried separately, so the figure
 * always describes what is visible — a filtered list showing an unfiltered total
 * would be read as the wrong answer to the question that was asked.
 */
async function ListSummary({ payments }: { payments: Array<{ amount: number }> }) {
  const t = await getTranslations('payments.list');
  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
      <span className="text-muted-foreground">
        {t('count', { count: payments.length })}
      </span>
      <span>
        <span className="text-muted-foreground">{t('total')} </span>
        <span className="font-medium tabular-nums">{formatMoney(total)}</span>
      </span>
    </div>
  );
}

/**
 * Narrow ?method= to a real payment method.
 *
 * Keyed off the labels record so adding a method to the enum needs no change
 * here, and an unrecognised value falls through to no filter rather than an
 * empty page.
 */
function parseMethod(value: string | undefined): PaymentMethod | undefined {
  return value && value in PAYMENT_METHOD_LABELS
    ? (value as PaymentMethod)
    : undefined;
}
