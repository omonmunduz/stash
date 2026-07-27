/**
 * CUSTOMER LIST PAGE
 *
 * The answer to "who owes me money?" — which is the question this application
 * exists to answer, so it is the default ordering rather than a report hidden
 * behind a menu.
 *
 * Filter state comes from searchParams, so this stays a Server Component that
 * queries once per navigation. The alternative (client-side fetching) would add
 * a loading state to the most-visited page in the app.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CustomerList } from '@/features/customers/components/CustomerList';
import { CustomerFilters } from '@/features/customers/components/CustomerFilters';
import { getCustomerService } from '@/features/customers/server';
import { ROUTES } from '@/lib/constants/routes';
import { formatMoney } from '@/lib/utils/format';

export const metadata = {
  title: 'Customers',
};

interface CustomersPageProps {
  searchParams: Promise<{ q?: string; debt?: string; status?: string }>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams;
  const { service } = await getCustomerService();

  const search = params.q?.trim() || undefined;
  const debtorsOnly = params.debt === '1';
  const status = params.status === 'inactive' ? 'inactive' : 'active';

  const result = await service.list({
    search,
    status,
    hasBalance: debtorsOnly || undefined,
  });

  const hasFilters = Boolean(search) || debtorsOnly || status === 'inactive';

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Customers"
        description="Everyone who buys from you, and what they owe."
        action={
          <Button asChild>
            <Link href={ROUTES.customers.new}>
              <Plus aria-hidden="true" />
              Add customer
            </Link>
          </Button>
        }
      />

      {!result.success ? (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : (
        <>
          {/* useSearchParams in the filter bar requires a Suspense boundary
              during static rendering. */}
          <Suspense fallback={<div className="h-24" />}>
            <CustomerFilters />
          </Suspense>

          <ListSummary customers={result.data} />

          {result.data.length === 0 ? (
            hasFilters ? (
              <EmptyState
                title="No customers match those filters"
                description="Try a different search, or clear the filters to see everyone."
                icon={<Users className="size-6" aria-hidden="true" />}
              />
            ) : (
              <EmptyState
                title="No customers yet"
                description="Add the people and shops who buy from you. You can start with just a name and add details later."
                icon={<Users className="size-6" aria-hidden="true" />}
                action={
                  <Button asChild>
                    <Link href={ROUTES.customers.new}>
                      <Plus aria-hidden="true" />
                      Add your first customer
                    </Link>
                  </Button>
                }
              />
            )
          ) : (
            <CustomerList customers={result.data} />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Count and total owed for the current view.
 *
 * Summing the loaded rows rather than issuing a separate aggregate query keeps
 * the number consistent with the table beneath it — a filtered list showing an
 * unfiltered total would read as a bug.
 */
function ListSummary({ customers }: { customers: Array<{ current_balance: number }> }) {
  if (customers.length === 0) return null;

  const totalOwed = customers.reduce(
    (sum, customer) => sum + Math.max(0, customer.current_balance),
    0
  );
  const debtorCount = customers.filter((customer) => customer.current_balance > 0).length;

  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
      <span className="text-muted-foreground">
        {customers.length} {customers.length === 1 ? 'customer' : 'customers'}
      </span>
      {debtorCount > 0 && (
        <span>
          <span className="text-muted-foreground">Outstanding: </span>
          <span className="font-medium tabular-nums">{formatMoney(totalOwed)}</span>
          <span className="text-muted-foreground"> across {debtorCount}</span>
        </span>
      )}
    </div>
  );
}
