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
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { createProductAction, updateProductAction } from '@/app/actions/products';
import type { ProductFormValues } from '@/app/actions/products';
import type { Product } from '../types';
import { ROUTES } from '@/lib/constants/routes';

interface ProductFormProps {
  /** Present when editing; absent when creating. */
  product?: Product;
  /** Signed URL for the product image (only when editing) */
  productImageUrl?: string | null;
}

export function ProductForm({ product, productImageUrl }: ProductFormProps) {
  const t = useTranslations('products.form');
  const tActions = useTranslations('common.actions');
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
    image: null,
  });

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (field: keyof ProductFormValues) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
  };

  const handleImageSelect = (file: File | null) => {
    setValues((previous) => ({ ...previous, image: file }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      // Create FormData to handle file upload
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('sku', values.sku || '');
      formData.append('description', values.description || '');
      formData.append('category', values.category || '');
      formData.append('unit_of_measure', values.unit_of_measure || 'unit');
      formData.append('cost_price', values.cost_price || '');
      formData.append('sale_price', values.sale_price || '');
      formData.append('initial_quantity', values.initial_quantity || '');

      if (values.image) {
        formData.append('image', values.image);
      }

      const result = isEdit
        ? await updateProductAction(product.id, formData)
        : await createProductAction(formData);

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
        <legend className="text-sm font-medium">{t('sectionWhatItIs')}</legend>

        <div className="space-y-2">
          <Label htmlFor="name">
            {t('name')} <span aria-hidden="true">*</span>
          </Label>
          <Input
            id="name"
            value={values.name}
            onChange={set('name')}
            placeholder={t('namePlaceholder')}
            required
            minLength={2}
            maxLength={100}
            autoFocus={!isEdit}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sku">{t('sku')}</Label>
            <Input
              id="sku"
              value={values.sku}
              onChange={set('sku')}
              placeholder={t('skuPlaceholder')}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              {t('skuHelp')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">{t('category')}</Label>
            <Input
              id="category"
              value={values.category}
              onChange={set('category')}
              placeholder={t('categoryPlaceholder')}
              maxLength={50}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t('description')}</Label>
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
        <legend className="text-sm font-medium">{t('sectionProductImage')}</legend>

        <ImageUpload
          id="product_image"
          label={t('imageLabel')}
          currentImageUrl={productImageUrl}
          onFileSelect={handleImageSelect}
          disabled={isPending}
          helperText={t('imageHelp')}
        />
      </fieldset>

      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="text-sm font-medium">{t('sectionPricing')}</legend>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="cost_price">
              {t('costPrice')} <span aria-hidden="true">*</span>
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
            <p className="text-xs text-muted-foreground">{t('costPriceHelp')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sale_price">
              {t('salePrice')} <span aria-hidden="true">*</span>
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
            <p className="text-xs text-muted-foreground">{t('salePriceHelp')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit_of_measure">{t('unitOfMeasure')}</Label>
            <Input
              id="unit_of_measure"
              value={values.unit_of_measure}
              onChange={set('unit_of_measure')}
              placeholder={t('unitOfMeasurePlaceholder')}
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">
              {t('unitOfMeasureHelp')}
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
            <span className="text-muted-foreground">{t('profitPerUnit')} </span>
            <span className="font-medium tabular-nums">{profit.toFixed(2)}</span>
            <span className="text-muted-foreground">
              {' '}
              ({t('margin', { percent: marginPercent.toFixed(1) })})
            </span>
          </p>
        )}
      </fieldset>

      {!isEdit && (
        <fieldset className="space-y-4" disabled={isPending}>
          <legend className="text-sm font-medium">{t('sectionStock')}</legend>

          <div className="space-y-2">
            <Label htmlFor="initial_quantity">{t('initialQuantity')}</Label>
            <Input
              id="initial_quantity"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.001"
              value={values.initial_quantity}
              onChange={set('initial_quantity')}
              placeholder={t('initialQuantityPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('initialQuantityHelp')}
            </p>
          </div>
        </fieldset>
      )}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" disabled={isPending} className="sm:w-auto">
          {isPending
            ? isEdit
              ? t('saving')
              : t('adding')
            : isEdit
              ? t('saveChanges')
              : t('addProductButton')}
        </Button>
        <Button asChild variant="outline" disabled={isPending} className="sm:w-auto">
          <Link href={ROUTES.products.list}>{tActions('cancel')}</Link>
        </Button>
      </div>
    </form>
  );
}
