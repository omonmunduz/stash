/**
 * SALE LIST
 *
 * Two layouts from one dataset, matching CustomerList: stacked cards on phones,
 * a table above sm. The column that matters most on a phone is what is still
 * owed, and a horizontally scrolling table is exactly how you lose it.
 *
 * A Server Component — it receives loaded sales and holds no state.
 */

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Sale } from '../types';
import { ROUTES } from '@/lib/constants/routes';
import { formatDate, formatMoney } from '@/lib/utils/format';

/** Customer names for the sales on this page, keyed by customer id. */
export type CustomerNameMap = Map<string, string>;

interface SaleListProps {
  sales: Sale[];
  customerNames: CustomerNameMap;
}

export function SaleList({ sales, customerNames }: SaleListProps) {
  return (
    <>
      {/* Phone layout: one tappable card per sale. */}
      <ul className="divide-y divide-border rounded-lg border border-border sm:hidden">
        {sales.map((sale) => (
          <li key={sale.id}>
            <Link
              href={ROUTES.sales.detail(sale.id)}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">
                    {customerNames.get(sale.customer_id) ?? 'Unknown customer'}
                  </span>
                  {sale.status === 'cancelled' && (
                    <Badge variant="secondary" className="shrink-0">
                      Cancelled
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground tabular-nums">
                  {sale.sale_number ?? 'Draft'} · {formatDate(sale.sale_date)}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <span className="font-medium tabular-nums">
                  {formatMoney(sale.total)}
                </span>
                <p className="text-xs">
                  {sale.amount_due > 0 ? (
                    <span className="text-muted-foreground">
                      {formatMoney(sale.amount_due)} due
                    </span>
                  ) : (
                    <span className="text-emerald-700">Paid</span>
                  )}
                </p>
              </div>

              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablet and up: the columns that do not fit on a phone. */}
      <div className="hidden rounded-lg border border-border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Still due</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell className="tabular-nums">
                  {/* The link wraps only the number rather than the row: a whole
                      row rendered as an anchor is not valid table markup. */}
                  <Link
                    href={ROUTES.sales.detail(sale.id)}
                    className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {sale.sale_number ?? 'Draft'}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={ROUTES.customers.detail(sale.customer_id)}
                    className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {customerNames.get(sale.customer_id) ?? 'Unknown customer'}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(sale.sale_date)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(sale.total)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {sale.amount_due > 0 ? (
                    <span className="font-medium">{formatMoney(sale.amount_due)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {sale.status === 'cancelled' ? (
                    <Badge variant="secondary">Cancelled</Badge>
                  ) : (
                    <PaymentStatusBadge status={sale.payment_status} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function PaymentStatusBadge({ status }: { status: Sale['payment_status'] }) {
  switch (status) {
    case 'paid':
      return <Badge variant="success">Paid</Badge>;
    case 'partial':
      return <Badge variant="warning">Part paid</Badge>;
    case 'unpaid':
      return <Badge variant="outline">Unpaid</Badge>;
  }
}
