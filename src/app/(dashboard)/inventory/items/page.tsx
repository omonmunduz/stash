/**
 * SUPPLY CATALOGUE PAGE
 *
 * Non-sellable stock: packaging, cleaning supplies, anything the business buys and
 * uses rather than sells.
 *
 * Kept separate from Products because the two are answering different questions.
 * Mixing them would put carrier bags in the picker when recording a sale, and the
 * schema reflects that split — inventory_items has no sale_price at all.
 *
 * A Server Component; search and status come from searchParams.
 */

import Link from 'next/link';
import { Boxes, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InventoryItemList } from '@/features/inventory/components/InventoryItemList';
import { getInventoryService } from '@/features/inventory/server';
import { hasRole } from '@/features/auth/roles';
import { ROUTES } from '@/lib/constants/routes';

export const metadata = {
  title: 'Supplies',
};

interface ItemsPageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const params = await searchParams;
  const { service, user } = await getInventoryService();

  const search = params.q?.trim() || undefined;
  const status = params.status === 'all' ? 'all' : 'active';

  const result = await service.listItems({ search, status });
  const canAdd = hasRole(user, 'manager');

  const addButton = canAdd ? (
    <Button asChild>
      <Link href={ROUTES.inventory.items.new}>
        <Plus aria-hidden="true" />
        Add item
      </Link>
    </Button>
  ) : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Supplies"
        description="Things you buy and use, but do not sell."
        action={addButton}
      />

      {!result.success ? (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : result.data.length === 0 ? (
        search ? (
          <EmptyState
            title="Nothing matches that search"
            description="Try a different name or item code."
            icon={<Boxes className="size-6" aria-hidden="true" />}
          />
        ) : (
          <EmptyState
            title="No supplies yet"
            description="Add the things you buy but do not sell — bags, tape, cleaning supplies — to track when they run low."
            icon={<Boxes className="size-6" aria-hidden="true" />}
            action={
              canAdd ? (
                <Button asChild>
                  <Link href={ROUTES.inventory.items.new}>
                    <Plus aria-hidden="true" />
                    Add your first item
                  </Link>
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {result.data.length} {result.data.length === 1 ? 'item' : 'items'}
          </p>
          <InventoryItemList items={result.data} />
        </>
      )}
    </div>
  );
}
