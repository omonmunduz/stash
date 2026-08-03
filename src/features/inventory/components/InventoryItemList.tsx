/**
 * INVENTORY ITEM LIST
 *
 * The catalogue of non-sellable supplies. Cards on phones, table above, matching
 * ProductList.
 *
 * This is the catalogue rather than the stock screen, so it leads with what each
 * item is and costs. Quantities live on /inventory, which shows products and
 * supplies together — the question "what do I need to reorder" is not one you ask
 * about supplies in isolation.
 *
 * A Server Component: it receives loaded items and holds no state.
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
import type { InventoryItem } from '../types';
import { ROUTES } from '@/lib/constants/routes';
import { formatMoney, formatQuantity } from '@/lib/utils/format';

/** Reorder threshold, or a dash when none is set. */
function ReorderLevel({ level, unit }: { level: number | null; unit: string }) {
  if (level === null) {
    return (
      <span className="text-muted-foreground" title="No warning set">
        —
      </span>
    );
  }

  return (
    <span className="tabular-nums">
      {formatQuantity(level)} <span className="text-muted-foreground">{unit}</span>
    </span>
  );
}

export function InventoryItemList({ items }: { items: InventoryItem[] }) {
  return (
    <>
      {/* Phone layout. */}
      <ul className="divide-y divide-border rounded-lg border border-border sm:hidden">
        {items.map((item) => (
          <li key={item.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={ROUTES.inventory.items.edit(item.id)}
                    className="truncate font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {item.name}
                  </Link>
                  {!item.is_active && (
                    <Badge variant="secondary" className="shrink-0">
                      Inactive
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground tabular-nums">
                  {item.item_code}
                  {item.category && ` · ${item.category}`}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="font-medium tabular-nums">
                  {formatMoney(item.cost_price)}
                </p>
                <p className="text-xs text-muted-foreground">
                  per {item.unit_of_measure}
                </p>
              </div>
            </div>

            {/* Adjusting stock is the common follow-up, so it is one tap from here
                rather than only from the stock screen. */}
            <div className="mt-2 flex items-center justify-between gap-2 text-sm">
              <span className="text-xs text-muted-foreground">
                {item.reorder_level !== null
                  ? `Warn below ${formatQuantity(item.reorder_level)} ${item.unit_of_measure}`
                  : 'No stock warning'}
              </span>
              <Link
                href={ROUTES.inventory.adjust('item', item.id)}
                className="shrink-0 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Adjust stock
              </Link>
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
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Warn below</TableHead>
              <TableHead className="w-px" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  {/* The link wraps the name only — a row-level anchor is not valid
                      table markup and breaks selection in the other cells. */}
                  <Link
                    href={ROUTES.inventory.items.edit(item.id)}
                    className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {item.name}
                  </Link>
                  {item.category && (
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  )}
                  {!item.is_active && (
                    <Badge variant="secondary" className="mt-1">
                      Inactive
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {item.item_code}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(item.cost_price)}
                  <p className="text-xs font-normal text-muted-foreground">
                    per {item.unit_of_measure}
                  </p>
                </TableCell>
                <TableCell className="text-right text-sm">
                  <ReorderLevel
                    level={item.reorder_level}
                    unit={item.unit_of_measure}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={ROUTES.inventory.adjust('item', item.id)}
                    className="whitespace-nowrap text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    Adjust stock
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
