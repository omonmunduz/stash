/**
 * PRODUCT LIST
 *
 * Two layouts from one dataset, matching CustomerList: stacked cards on phones,
 * a table on tablet and up. The phone card leads with name and price because
 * that is what someone checks mid-conversation; stock sits beside it.
 *
 * A Server Component — it receives loaded products and holds no state.
 */

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ProductWithInventory } from '../types';
import { ROUTES } from '@/lib/constants/routes';
import { formatMoney, formatQuantity } from '@/lib/utils/format';

/**
 * Stock badge.
 *
 * Only two states, because the schema has no per-product reorder threshold to
 * define a third. Out of stock is worth flagging loudly — it is the case that
 * blocks a sale.
 */
function StockLevel({ quantity, unit }: { quantity: number; unit: string }) {
  if (quantity <= 0) {
    return <Badge variant="destructive">Out of stock</Badge>;
  }

  return (
    <span className="tabular-nums">
      {formatQuantity(quantity)}{' '}
      <span className="text-muted-foreground">{unit}</span>
    </span>
  );
}

export function ProductList({ products }: { products: ProductWithInventory[] }) {
  return (
    <>
      {/* Phone layout. */}
      <ul className="divide-y divide-border rounded-lg border border-border sm:hidden">
        {products.map((product) => (
          <li key={product.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={ROUTES.products.edit(product.id)}
                    className="truncate font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {product.name}
                  </Link>
                  {!product.is_active && (
                    <Badge variant="secondary" className="shrink-0">
                      Inactive
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground tabular-nums">
                  {product.sku}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="font-medium tabular-nums">
                  {formatMoney(product.sale_price)}
                </p>
                <p className="text-xs text-muted-foreground">
                  per {product.unit_of_measure}
                </p>
              </div>
            </div>

            <div className="mt-2 text-sm">
              <StockLevel
                quantity={product.quantity_on_hand}
                unit={product.unit_of_measure}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet and up. */}
      <div className="hidden rounded-lg border border-border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">In stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  {/* Link wraps the name only — a row-level anchor is not valid
                      table markup and breaks selection in the other cells. */}
                  <Link
                    href={ROUTES.products.edit(product.id)}
                    className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {product.name}
                  </Link>
                  {product.category && (
                    <p className="text-xs text-muted-foreground">{product.category}</p>
                  )}
                  {!product.is_active && (
                    <Badge variant="secondary" className="mt-1">
                      Inactive
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {product.sku}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                  {formatMoney(product.cost_price)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(product.sale_price)}
                  <p className="text-xs font-normal text-muted-foreground">
                    per {product.unit_of_measure}
                  </p>
                </TableCell>
                <TableCell className="text-right text-sm">
                  <StockLevel
                    quantity={product.quantity_on_hand}
                    unit={product.unit_of_measure}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
