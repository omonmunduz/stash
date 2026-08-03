/**
 * NEW SUPPLY ITEM PAGE
 *
 * Guarded at manager and above, matching inventory_items_insert_manager_or_above
 * and the check inside createInventoryItemAction.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InventoryItemForm } from '@/features/inventory/components/InventoryItemForm';
import { requireMinimumRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';

export const metadata = {
  title: 'Add item',
};

export default async function NewItemPage() {
  await requireMinimumRole('manager');

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.inventory.items.list}>
          <ArrowLeft aria-hidden="true" />
          Supplies
        </Link>
      </Button>

      <PageHeader
        title="Add item"
        description="Something you buy and use, but do not sell."
      />

      <Card>
        <CardContent className="pt-6">
          <InventoryItemForm />
        </CardContent>
      </Card>
    </div>
  );
}
