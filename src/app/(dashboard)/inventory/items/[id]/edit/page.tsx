/**
 * EDIT SUPPLY ITEM PAGE
 *
 * Guarded at manager and above, matching inventory_items_update_manager_or_above
 * and the check inside updateInventoryItemAction.
 *
 * The form has no stock field on edit — quantity moves through adjustments, which
 * keep a record of why. The link to that screen is here instead.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InventoryItemForm } from '@/features/inventory/components/InventoryItemForm';
import { getInventoryService } from '@/features/inventory/server';
import { requireMinimumRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import { brandId } from '@/lib/types/common';

export const metadata = {
  title: 'Edit item',
};

interface EditItemPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditItemPage({ params }: EditItemPageProps) {
  const { id } = await params;

  await requireMinimumRole('manager');

  const { service } = await getInventoryService();
  const result = await service.getItem(brandId<'InventoryItemId'>(id));

  if (!result.success) notFound();

  const item = result.data;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.inventory.items.list}>
          <ArrowLeft aria-hidden="true" />
          Supplies
        </Link>
      </Button>

      <PageHeader
        title="Edit item"
        description={item.item_code}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={ROUTES.inventory.adjust('item', item.id)}>
              Adjust stock
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <InventoryItemForm item={item} />
        </CardContent>
      </Card>
    </div>
  );
}
