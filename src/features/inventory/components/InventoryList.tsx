/**
 * INVENTORY LIST
 *
 * Two layouts from one dataset, matching ProductList: stacked cards on phones, a
 * table on tablet and up.
 *
 * The reason to open this screen is to find out what needs ordering, so the
 * quantity leads and low-stock rows are flagged and sorted first (the repository
 * does the sorting). Stock value is shown at cost — it is money already spent
 * that has not sold yet.
 *
 * Products and non-sellable items appear in one list. They differ in only two
 * places: where the name links to, and whether a sale price exists. Everything
 * else was lifted onto InventoryLine by the mapper precisely so this component
 * does not branch on subject.kind for every cell.
 *
 * A Server Component — it receives loaded lines and holds no state.
 */

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { InventoryLine } from '../types';
import { ROUTES } from '@/lib/constants/routes';
import { formatMoney, formatQuantity } from '@/lib/utils/format';

/** Where a line's name links to: its catalogue entry, not its stock. */
function editHref(line: InventoryLine): string {
  return line.subject.kind === 'product'
    ? ROUTES.products.edit(line.subject.product_id)
    : ROUTES.inventory.items.edit(line.subject.item_id);
}

/** Where the adjust control links to. */
function adjustHref(line: InventoryLine): string {
  return line.subject.kind === 'product'
    ? ROUTES.inventory.adjust('product', line.subject.product_id)
    : ROUTES.inventory.adjust('item', line.subject.item_id);
}

/**
 * Stock figure with its warning state.
 *
 * Three states, unlike ProductList's two, because an item can now carry a
 * reorder_level: gone, at or below the threshold, and fine. Out of stock is
 * flagged loudest — for a product it blocks a sale.
 *
 * Colour never carries the meaning alone; each state has text.
 */
function StockLevel({ line }: { line: InventoryLine }) {
  if (line.quantity_on_hand <= 0) {
    return <Badge variant="destructive">Out of stock</Badge>;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-medium tabular-nums">
        {formatQuantity(line.quantity_on_hand)}{' '}
        <span className="font-normal text-muted-foreground">
          {line.unit_of_measure}
        </span>
      </span>
      {line.is_low_stock && <Badge variant="warning">Low</Badge>}
    </span>
  );
}

/** Marks which of the two catalogues a line comes from. */
function KindBadge({ line }: { line: InventoryLine }) {
  if (line.subject.kind === 'product') return null;

  // Only items are marked. Products are the default expectation on a stock
  // screen, so badging both would add noise to every row to distinguish a
  // minority of them.
  return (
    <Badge variant="outline" className="shrink-0">
      Supply
    </Badge>
  );
}

export function InventoryList({
  lines,
  canAdjust,
}: {
  lines: InventoryLine[];
  /** Manager or above. The adjust control is hidden otherwise. */
  canAdjust: boolean;
}) {
  return (
    <>
      {/* Phone layout. */}
      <ul className="divide-y divide-border rounded-lg border border-border sm:hidden">
        {lines.map((line) => (
          <li key={line.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={editHref(line)}
                    className="truncate font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {line.subject.name}
                  </Link>
                  <KindBadge line={line} />
                </div>
                <p className="truncate text-xs text-muted-foreground tabular-nums">
                  {line.subject.code}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <StockLevel line={line} />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatMoney(line.stock_value)} at cost
              </p>

              {canAdjust && (
                <Button asChild variant="outline" size="sm">
                  <Link href={adjustHref(line)}>Adjust</Link>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet and up. */}
      <div className="hidden rounded-lg border border-border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">In stock</TableHead>
              <TableHead className="text-right">Value at cost</TableHead>
              {canAdjust && <TableHead className="w-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  {/* Link wraps the name only — a row-level anchor is not valid
                      table markup and breaks selection in the other cells. */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={editHref(line)}
                      className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {line.subject.name}
                    </Link>
                    <KindBadge line={line} />
                  </div>
                  {!line.is_active && (
                    <Badge variant="secondary" className="mt-1">
                      Inactive
                    </Badge>
                  )}
                </TableCell>

                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {line.subject.code}
                </TableCell>

                <TableCell className="text-right text-sm">
                  <StockLevel line={line} />
                  {line.reorder_level !== null && (
                    <p className="text-xs font-normal text-muted-foreground tabular-nums">
                      reorder at {formatQuantity(line.reorder_level)}
                    </p>
                  )}
                </TableCell>

                <TableCell className="text-right text-sm tabular-nums">
                  {formatMoney(line.stock_value)}
                  <p className="text-xs font-normal text-muted-foreground tabular-nums">
                    {formatMoney(line.cost_price)} each
                  </p>
                </TableCell>

                {canAdjust && (
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={adjustHref(line)}>Adjust</Link>
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
