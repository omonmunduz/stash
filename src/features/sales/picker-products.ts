/**
 * PICKER PRODUCT PROJECTION
 *
 * Narrows a loaded catalog down to what a product picker renders.
 *
 * This exists so pages do not pass whole Product objects into client components.
 * A Product carries cost_price, which is the business's margin and has no reason
 * to reach the browser on a screen that only needs to name a product and price
 * it. Everything in PickerProduct is already visible to the user on the sale
 * itself.
 */

import type { PickerProduct } from './components/ProductPicker';
import type { ProductWithInventory } from '@/features/products/types';

export function toPickerProducts(products: ProductWithInventory[]): PickerProduct[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    sale_price: product.sale_price,
    quantity_on_hand: product.quantity_on_hand,
  }));
}
