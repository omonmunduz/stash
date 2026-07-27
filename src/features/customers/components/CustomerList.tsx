/**
 * CUSTOMER LIST
 *
 * Renders two layouts from one dataset: a table on tablet and up, stacked cards
 * on phones. This is deliberate rather than a responsive table — the primary
 * user is on a phone, and a horizontally scrolling table hides exactly the
 * column that matters most (the balance).
 *
 * A Server Component: it receives already-loaded customers and holds no state.
 * The only interactive part of the list page is the filter bar.
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
import { BalanceAmount, CreditStandingBadge } from './CustomerBalance';
import { getCustomerDisplayName } from '../business-rules';
import type { Customer } from '../types';
import { ROUTES } from '@/lib/constants/routes';
import { formatMoney } from '@/lib/utils/format';

export function CustomerList({ customers }: { customers: Customer[] }) {
  return (
    <>
      {/* Phone layout: one tappable card per customer. */}
      <ul className="divide-y divide-border rounded-lg border border-border sm:hidden">
        {customers.map((customer) => (
          <li key={customer.id}>
            <Link
              href={ROUTES.customers.detail(customer.id)}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">
                    {getCustomerDisplayName(customer)}
                  </span>
                  {!customer.is_active && (
                    <Badge variant="secondary" className="shrink-0">
                      Inactive
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {customer.phone ?? customer.customer_code}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <BalanceAmount customer={customer} />
                {customer.credit_limit !== null && (
                  <p className="text-xs text-muted-foreground">
                    of {formatMoney(customer.credit_limit)}
                  </p>
                )}
              </div>

              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablet and up: full table with the columns that do not fit on a phone. */}
      <div className="hidden rounded-lg border border-border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>
                  {/* The link wraps only the name rather than the row: a whole
                      row rendered as an anchor is not valid table markup and
                      breaks text selection in the other cells. */}
                  <Link
                    href={ROUTES.customers.detail(customer.id)}
                    className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {getCustomerDisplayName(customer)}
                  </Link>
                  {customer.business_name && (
                    <p className="text-xs text-muted-foreground">{customer.name}</p>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {customer.customer_code}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {customer.phone ?? '—'}
                </TableCell>
                <TableCell className="text-right">
                  <BalanceAmount customer={customer} />
                  {customer.credit_limit !== null && (
                    <p className="text-xs text-muted-foreground">
                      of {formatMoney(customer.credit_limit)}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {customer.is_active ? (
                    <CreditStandingBadge customer={customer} />
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
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
