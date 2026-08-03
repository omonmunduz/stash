/**
 * INVENTORY ITEM FORM
 *
 * Create and edit for non-sellable stock: carrier bags, tape, cleaning supplies.
 * Things the business buys and uses up but never puts on an invoice.
 *
 * Shaped as ProductForm minus selling price, deliberately — the two are the same
 * job apart from that one field, and a shopkeeper who has added a product should
 * recognise this immediately.
 *
 * Two differences worth naming:
 * - There is a reorder level here. It matters more for supplies than for stock you
 *   sell: running out of bags stops trade just as effectively as running out of
 *   biscuits, but nobody notices bags are low by watching sales.
 * - Blank reorder level is sent as null, not zero. "No warning wanted" and "warn
 *   me at zero" are different instructions, and collapsing them would nag about
 *   every item somebody chose not to track.
 */

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  createInventoryItemAction,
  updateInventoryItemAction,
} from '@/app/actions/inventory';
import type { InventoryItemFormValues } from '@/app/actions/inventory';
import type { InventoryItem } from '../types';
import { ROUTES } from '@/lib/constants/routes';

interface InventoryItemFormProps {
  /** Present when editing; absent when creating. */
  item?: InventoryItem;
}

export function InventoryItemForm({ item }: InventoryItemFormProps) {
  const isEdit = item !== undefined;

  const [values, setValues] = useState<InventoryItemFormValues>({
    name: item?.name ?? '',
    item_code: item?.item_code ?? '',
    description: item?.description ?? '',
    category: item?.category ?? '',
    unit_of_measure: item?.unit_of_measure ?? 'unit',
    cost_price: item ? String(item.cost_price) : '',
    reorder_level: item?.reorder_level !== null && item?.reorder_level !== undefined
      ? String(item.reorder_level)
      : '',
    initial_quantity: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (field: keyof InventoryItemFormValues) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateInventoryItemAction(item.id, values)
        : await createInventoryItemAction(values);

      // Only reached on failure — both actions redirect on success.
      if (!result.success) setError(result.error);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="text-sm font-medium">What it is</legend>

        <div className="space-y-2">
          <Label htmlFor="name">
            Name <span aria-hidden="true">*</span>
          </Label>
          <Input
            id="name"
            value={values.name}
            onChange={set('name')}
            placeholder="e.g., Small carrier bags"
            required
            minLength={2}
            maxLength={100}
            autoFocus={!isEdit}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="item_code">Item code</Label>
            <Input
              id="item_code"
              value={values.item_code}
              onChange={set('item_code')}
              placeholder="Leave blank to generate one"
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              Letters, numbers, hyphens.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={values.category}
              onChange={set('category')}
              placeholder="e.g., Packaging"
              maxLength={50}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={values.description}
            onChange={set('description')}
            maxLength={500}
            rows={2}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="text-sm font-medium">Cost and stock</legend>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="cost_price">
              Cost price <span aria-hidden="true">*</span>
            </Label>
            <Input
              id="cost_price"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={values.cost_price}
              onChange={set('cost_price')}
              required
            />
            <p className="text-xs text-muted-foreground">
              What you pay per {values.unit_of_measure || 'unit'}.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit_of_measure">Bought by</Label>
            <Input
              id="unit_of_measure"
              value={values.unit_of_measure}
              onChange={set('unit_of_measure')}
              placeholder="unit"
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">
              unit, box, roll, pack.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reorder_level">Warn me below</Label>
            <Input
              id="reorder_level"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.001"
              value={values.reorder_level}
              onChange={set('reorder_level')}
              placeholder="No warning"
            />
            <p className="text-xs text-muted-foreground">
              Flags it on the stock screen. Leave blank for no warning.
            </p>
          </div>
        </div>

        {!isEdit && (
          <div className="space-y-2">
            <Label htmlFor="initial_quantity">How many do you have now?</Label>
            <Input
              id="initial_quantity"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.001"
              value={values.initial_quantity}
              onChange={set('initial_quantity')}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Recorded as opening stock. Change it later from the stock screen so
              the reason is kept.
            </p>
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" disabled={isPending} className="sm:w-auto">
          {isPending
            ? isEdit
              ? 'Saving...'
              : 'Adding...'
            : isEdit
              ? 'Save changes'
              : 'Add item'}
        </Button>
        <Button asChild variant="outline" disabled={isPending} className="sm:w-auto">
          <Link href={ROUTES.inventory.items.list}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
