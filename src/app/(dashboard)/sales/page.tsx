/**
 * SALES LIST PAGE
 *
 * Every transaction, newest first. The default view is everything rather than
 * only unpaid: this doubles as the day book, and "what went out today" is asked
 * as often as "who still owes".
 *
 * Customer names come from a second query rather than a join, so the sale
 * repository keeps returning plain Sale rows. The two reads are issued in
 * parallel, so the name lookup costs no extra latency.
 */

import Link from 'next/link';
import { Plus, Receipt } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SaleList, type CustomerNameMap } from '@/features/sales/components/SaleList';
import { getSaleService } from '@/features/sales/server';
import { getCustomerService } from '@/features/customers/server';
import { ROUTES } from '@/lib/constants/routes';
import { formatMoney } from '@/lib/utils/format';

export const metadata = {
  title: 'Sales',
};

interface SalesPageProps {
  searchParams: Promise<{ unpaid?: string }>;
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const params = await searchParams;
  const unpaidOnly = params.unpaid === '1';
  const t = await getTranslations('sales');

  // Both factories resolve the same request-memoized auth state, so these run
  // concurrently instead of the second waiting on the first.
  const [{ service }, { service: customerService }] = await Promise.all([
    getSaleService(),
    getCustomerService(),
  ]);

  // Customers are now fetched unconditionally. Skipping them when there are no
  // sales saved a round trip in the rare empty case, but it forced the common
  // case to serialise: the customer query could not start until the sale list
  // came back. Overlapping them is the better trade.
  const [result, namesResult] = await Promise.all([
    service.list(unpaidOnly ? { overdueOnly: true } : {}),
    customerService.listNames(),
  ]);

  // Names for the sales actually on the page, keyed by id rather than joined, so
  // the sale rows stay plain Sale shapes. listNames() reads three columns and
  // builds the map in the service; this page previously pulled every customer
  // column to use two of them.
  const customerNames: CustomerNameMap = namesResult.success
    ? namesResult.data
    : new Map();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <Button asChild>
            <Link href={ROUTES.sales.new}>
              <Plus aria-hidden="true" />
              {t('recordSale')}
            </Link>
          </Button>
        }
      />

      {!result.success ? (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : result.data.length === 0 ? (
        unpaidOnly ? (
          <EmptyState
            title={t('list.nothingOverdue.title')}
            description={t('list.nothingOverdue.description')}
            icon={<Receipt className="size-6" aria-hidden="true" />}
            action={
              <Button asChild variant="outline">
                <Link href={ROUTES.sales.list}>{t('list.seeAll')}</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={t('list.empty.title')}
            description={t('list.empty.description')}
            icon={<Receipt className="size-6" aria-hidden="true" />}
            action={
              <Button asChild>
                <Link href={ROUTES.sales.new}>
                  <Plus aria-hidden="true" />
                  {t('recordFirstSale')}
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <ListSummary sales={result.data} />
            <Button asChild variant="outline" size="sm">
              <Link href={unpaidOnly ? ROUTES.sales.list : `${ROUTES.sales.list}?unpaid=1`}>
                {unpaidOnly ? t('list.showAll') : t('list.showOverdue')}
              </Link>
            </Button>
          </div>

          <SaleList sales={result.data} customerNames={customerNames} />
        </>
      )}
    </div>
  );
}

/**
 * Count and outstanding total for the current view.
 *
 * Summed from the loaded rows rather than a separate aggregate, so a filtered
 * list cannot show an unfiltered total — the same reasoning as the customers
 * page.
 */
async function ListSummary({ sales }: { sales: Array<{ amount_due: number }> }) {
  const t = await getTranslations('sales.list');
  const outstanding = sales.reduce((sum, sale) => sum + Math.max(0, sale.amount_due), 0);

  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
      <span className="text-muted-foreground">
        {t('count', { count: sales.length })}
      </span>
      {outstanding > 0 && (
        <span>
          <span className="text-muted-foreground">{t('stillOwed')} </span>
          <span className="font-medium tabular-nums">{formatMoney(outstanding)}</span>
        </span>
      )}
    </div>
  );
}
