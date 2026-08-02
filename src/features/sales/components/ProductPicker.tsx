/**
 * PRODUCT PICKER
 *
 * A product chooser for sale lines.
 *
 * Why a native <select> rather than a combobox: the project has no select or
 * popover primitive, and on a phone the native control opens the OS picker —
 * a full-height scrollable wheel with type-to-search built in. A custom
 * dropdown would be more code and worse on the device this app is used on.
 * When the catalog outgrows it, the replacement is a search field backed by
 * searchProductsAction, not a fancier dropdown.
 *
 * Stock is shown in the option label rather than as a separate hint, because
 * the moment someone is choosing a product is the moment "do I still have
 * these?" matters. It is advisory only — the sale RPC is what actually refuses
 * to oversell.
 */

'use client';

import { cn } from '@/lib/utils/cn';
import { formatQuantity } from '@/lib/utils/format';

/** The little a picker needs to know about a product. */
export interface PickerProduct {
  id: string;
  name: string;
  sku: string;
  sale_price: number;
  /** Omitted when the caller did not load inventory. */
  quantity_on_hand?: number;
}

interface ProductPickerProps {
  id?: string;
  value: string;
  onChange: (productId: string) => void;
  products: PickerProduct[];
  disabled?: boolean;
  required?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function ProductPicker({
  id,
  value,
  onChange,
  products,
  disabled,
  required,
  className,
  'aria-label': ariaLabel,
}: ProductPickerProps) {
  /**
   * A line can reference a product that has since been deactivated, and the
   * caller only passes active products. Without this the select would silently
   * fall back to its first option and a save would move the line onto a
   * different product than the one on screen.
   */
  const isMissing = value !== '' && !products.some((product) => product.id === value);

  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel}
      className={cn(
        // Matches Input: h-11 for the mobile tap target, same border and ring.
        'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      <option value="">Choose a product...</option>

      {isMissing && (
        <option value={value}>
          (this product is no longer in the catalog)
        </option>
      )}

      {products.map((product) => (
        <option key={product.id} value={product.id}>
          {optionLabel(product)}
        </option>
      ))}
    </select>
  );
}

/**
 * "Chocolate biscuits 200g — 45.00 (12 in stock)"
 *
 * Built as one string because option elements cannot be styled into columns;
 * an em dash reads better than a pipe when a screen reader speaks it.
 */
function optionLabel(product: PickerProduct): string {
  const parts = [product.name, `${product.sale_price.toFixed(2)}`];

  if (product.quantity_on_hand !== undefined) {
    parts.push(
      product.quantity_on_hand > 0
        ? `${formatQuantity(product.quantity_on_hand)} in stock`
        : 'out of stock'
    );
  }

  return `${parts[0]} — ${parts[1]}${parts[2] ? ` (${parts[2]})` : ''}`;
}
