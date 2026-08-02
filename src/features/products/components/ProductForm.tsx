/**
 * PRODUCT FORM
 *
 * One component for create and edit, like CustomerForm — they differ only in
 * which action they call and what the button says.
 *
 * Design decisions:
 * - Name, cost, and price are the required fields. Cost is required because
 *   every profit figure in the app derives from it; a product saved without one
 *   would quietly report 100% margin.
 * - SKU is optional and derived from the name when blank, so entering a product
 *   mid-conversation does not mean inventing a code first.
 * - Opening stock appears only on create. Changing stock later is an inventory
 *   adjustment; letting an edit form overwrite the on-hand count would discard
 *   whatever had been sold since.
 * - No success state: the action redirects. isPending stays true through the
 *   navigation, which keeps the button disabled and blocks a double submit.
 */

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createProductAction, updateProductAction } from '@/app/actions/products';
import type { ProductFormValues } from '@/app/actions/products';
import type { Product } from '../types';
import { ROUTES } from '@/lib/constants/routes';

interface ProductFormProps {
  /** Present when editing; absent when creating. */
  product?: Product;
}

export function ProductForm({ product }: ProductFormProps) {
  const isEdit = product !== undefined;

  const [values, setValues] = useState<ProductFormValues>({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    description: product?.description ?? '',
    category: product?.category ?? '',
    unit_of_measure: product?.unit_of_measure ?? 'unit',
    cost_price: product ? String(product.cost_price) : '',
    sale_price: product ? String(product.sale_price) : '',
    initial_quantity: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (field: keyof ProductFormValues) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateProductAction(product.id, values)
        : await createProductAction(values);

      // Only reached on failure — both actions redirect on success.
      if (!result.success) setError(result.error);
    });
  };

  // Live margin readout. Shown while typing because the moment someone enters a
  // selling price is the moment they are deciding whether it is high enough.
  const cost = Number(values.cost_price);
  const price = Number(values.sale_price);
  const showMargin =
    values.cost_price !== '' &&
    values.sale_price !== '' &&
    !Number.isNaN(cost) &&
    !Number.isNaN(price) &&
    price > 0;
  const profit = price - cost;
  const marginPercent = showMargin ? (profit / price) * 100 : 0;

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
            placeholder="e.g., Chocolate biscuits 200g"
            required
            minLength={2}
            maxLength={100}
            autoFocus={!isEdit}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sku">Product code</Label>
            <Input
              id="sku"
              value={values.sku}
              onChange={set('sku')}
              placeholder="Leave blank to generate one"
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              Letters, numbers, hyphens. Used to find the product quickly.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={values.category}
              onChange={set('category')}
              placeholder="e.g., Biscuits"
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
        <legend className="text-sm font-medium">Pricing</legend>

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
            <p className="text-xs text-muted-foreground">What you pay for it.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sale_price">
              Selling price <span aria-hidden="true">*</span>
            </Label>
            <Input
              id="sale_price"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={values.sale_price}
              onChange={set('sale_price')}
              required
            />
            <p className="text-xs text-muted-foreground">What customers pay.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit_of_measure">Sold by</Label>
            <Input
              id="unit_of_measure"
              value={values.unit_of_measure}
              onChange={set('unit_of_measure')}
              placeholder="unit"
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">
              unit, box, kg, packet.
            </p>
          </div>
        </div>

        {showMargin && (
          <p
            className="text-sm"
            // Announced politely so the figure is available to a screen reader
            // as it changes, without interrupting typing.
            aria-live="polite"
          >
            <span className="text-muted-foreground">Profit per unit: </span>
            <span className="font-medium tabular-nums">{profit.toFixed(2)}</span>
            <span className="text-muted-foreground">
              {' '}
              ({marginPercent.toFixed(1)}% margin)
            </span>
          </p>
        )}
      </fieldset>

      {!isEdit && (
        <fieldset className="space-y-4" disabled={isPending}>
          <legend className="text-sm font-medium">Stock</legend>

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
              Leave blank if you are not counting stock for this product yet.
            </p>
          </div>
        </fieldset>
      )}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" disabled={isPending} className="sm:w-auto">
          {isPending
            ? isEdit
              ? 'Saving...'
              : 'Adding...'
            : isEdit
              ? 'Save changes'
              : 'Add product'}
        </Button>
        <Button asChild variant="outline" disabled={isPending} className="sm:w-auto">
          <Link href={ROUTES.products.list}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
