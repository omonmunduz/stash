/**
 * PAYMENT LIST
 *
 * The day book: money in, newest first. Cards on phones, a table above, matching
 * SaleList and ProductList.
 *
 * Amounts are green here and nowhere else in a list, because this is the one screen
 * where every row is money arriving. CustomerHistory already renders received
 * payments the same way, so the colour carries the same meaning in both places.
 *
 * Which invoices a payment cleared is deliberately not shown. This list answers
 * "what came in"; the allocation breakdown lives on the customer's own page, next
 * to the invoices it refers to, where it means something.
 *
 * A Server Component — it receives loaded payments and holds no state.
 */

import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PaymentRowActions } from './PaymentRowActions';
import type { Payment } from '../types';
import { PAYMENT_METHOD_LABELS } from '../labels';
import { ROUTES } from '@/lib/constants/routes';
import { formatMoney, formatDate } from '@/lib/utils/format';

/** Customer id → display name, resolved by the page. */
export type CustomerNameMap = Map<string, string>;

interface PaymentListProps {
  payments: Payment[];
  customerNames: CustomerNameMap;
  /** Manager and above. Controls the correct/void column. */
  canEdit: boolean;
}

export function PaymentList({
  payments,
  customerNames,
  canEdit,
}: PaymentListProps) {
  /**
   * A payment whose customer is missing from the map still renders. The alternative
   * — hiding the row — would make the totals above it stop adding up, which is a
   * worse failure on a screen about money than an unnamed line.
   */
  const nameFor = (payment: Payment) =>
    customerNames.get(payment.customer_id) ?? 'Unknown customer';

  return (
    <>
      {/* Phone layout. */}
      <ul className="divide-y divide-border rounded-lg border border-border sm:hidden">
        {payments.map((payment) => (
          <li key={payment.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={ROUTES.customers.detail(payment.customer_id)}
                  className="block truncate font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {nameFor(payment)}
                </Link>
                <p className="truncate text-xs text-muted-foreground tabular-nums">
                  {payment.payment_number} · {formatDate(payment.payment_date)}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="font-medium tabular-nums text-emerald-700">
                  {formatMoney(payment.amount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[payment.payment_method]}
                </p>
              </div>
            </div>

            {payment.reference_number && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                Ref {payment.reference_number}
              </p>
            )}

            {canEdit && (
              <div className="mt-2">
                <PaymentRowActions
                  payment={payment}
                  customerId={payment.customer_id}
                  canEdit={canEdit}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Tablet and up. */}
      <div className="hidden rounded-lg border border-border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {canEdit && <TableHead className="w-px" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="align-top font-medium tabular-nums">
                  {payment.payment_number}
                </TableCell>

                <TableCell className="align-top">
                  {/* The link wraps the name only — a row-level anchor is not valid
                      table markup and breaks selection in the other cells. */}
                  <Link
                    href={ROUTES.customers.detail(payment.customer_id)}
                    className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {nameFor(payment)}
                  </Link>
                </TableCell>

                <TableCell className="align-top text-sm text-muted-foreground">
                  {formatDate(payment.payment_date)}
                </TableCell>

                <TableCell className="align-top text-sm text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[payment.payment_method]}
                  {payment.reference_number && (
                    <span className="block text-xs">{payment.reference_number}</span>
                  )}
                </TableCell>

                <TableCell className="align-top text-right font-medium tabular-nums text-emerald-700">
                  {formatMoney(payment.amount)}
                </TableCell>

                {canEdit && (
                  <TableCell className="align-top">
                    <PaymentRowActions
                      payment={payment}
                      customerId={payment.customer_id}
                      canEdit={canEdit}
                    />
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
