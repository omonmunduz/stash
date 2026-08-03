/**
 * INVENTORY LIST PAGE
 *
 * The answer to "what do I need to order?" — so low stock sorts to the top by
 * default rather than living behind a filter, and the reorder chip is there for
 * when that list is all you want to see.
 *
 * Counts both things the business stocks: products it sells, and supplies it
 * consumes. Filter state comes from searchParams, so this stays a Server
 * Component that queries once per navigation.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Boxes, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InventoryList } from '@/features/inventory/components/InventoryList';
import { InventoryFilters } from '@/features/inventory/components/InventoryFilters';
import { getInventoryService } from '@/features/inventory/server';
import { hasRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import { formatMoney } from '@/lib/utils/format';

export const metadata = {
  title: 'Inventory',
};

interface InventoryPageProps {
  searchParams: Promise<{ q?: string; kind?: string; low?: string }>;
}

/** Only the three values the filter offers; anything else falls back to 'all'. */
function toKind(value: string | undefined): 'all' | 'products' | 'items' {
  return value === 'products' || value === 'items' ? value : 'all';
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const params = await searchParams;
  const { service, user } = await getInventoryService();

  const search = params.q?.trim() || undefined;
  const kind = toKind(params.kind);
  const lowStockOnly = params.low === '1';

  const result = await service.list({
    search,
    kind,
    low_stock_only: lowStockOnly || undefined,
  });

  // Manager or above, matching adjust_inventory's own role check. Hiding the
  // control is an affordance, not the boundary — the RPC re-checks.
  const canAdjust = hasRole(user, 'manager');

  const hasFilters = Boolean(search) || kind !== 'all' || lowStockOnly;

  // Totals describe what is on screen, so they follow the filters rather than
  // reporting the whole organization under a narrowed list.
  const totalValue = result.success
    ? result.data.reduce((sum, line) => sum + line.stock_value, 0)
    : 0;
  const lowStockCount = result.success
    ? result.data.filter((line) => line.is_low_stock).length
    : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Inventory"
        description="What is on the shelves, and what is running out."
        action={
          canAdjust ? (
            <Button asChild variant="outline">
              <Link href={ROUTES.inventory.items.new}>
                <Plus aria-hidden="true" />
                Add supply
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/*
        useSearchParams() suspends during prerender, so the filter bar needs a
        boundary. Falling back to null rather than a skeleton — the list below is
        server-rendered and already useful.
      */}
      <Suspense fallback={null}>
        <InventoryFilters />
      </Suspense>

      {!result.success ? (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : result.data.length === 0 ? (
        hasFilters ? (
          <EmptyState
            title="Nothing matches those filters"
            description={
              lowStockOnly
                ? 'Nothing is at or below its reorder level. Set a reorder level on a product or supply to be warned before it runs out.'
                : 'Try a different name or code.'
            }
            icon={<Boxes className="size-6" aria-hidden="true" />}
          />
        ) : (
          <EmptyState
            title="Nothing is being counted yet"
            description="Stock is tracked for every product you add, plus any supplies you count separately — packaging, bags, cleaning materials."
            icon={<Boxes className="size-6" aria-hidden="true" />}
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild>
                  <Link href={ROUTES.products.new}>
                    <Plus aria-hidden="true" />
                    Add a product
                  </Link>
                </Button>
                {canAdjust && (
                  <Button asChild variant="outline">
                    <Link href={ROUTES.inventory.items.new}>Add a supply</Link>
                  </Button>
                )}
              </div>
            }
          />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm text-muted-foreground">
              {result.data.length} {result.data.length === 1 ? 'line' : 'lines'}
              {lowStockCount > 0 && !lowStockOnly && (
                <> · {lowStockCount} need reordering</>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              Stock value at cost:{' '}
              <span className="font-medium tabular-nums text-foreground">
                {formatMoney(totalValue)}
              </span>
            </p>
          </div>

          <InventoryList lines={result.data} canAdjust={canAdjust} />
        </>
      )}
    </div>
  );
}
