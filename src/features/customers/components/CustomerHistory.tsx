/**
 * CUSTOMER HISTORY
 *
 * The tab: what they took, what it cost, what they have paid.
 *
 * The lump balance on the list page answers "how much?". This answers "for
 * what?" — every transaction expands to the products on it, which is the
 * question the shop owner actually gets asked when a customer disputes a figure.
 *
 * Design decisions:
 * - Rows expand in place instead of navigating. The customer is standing there
 *   and the answer is two taps away, not a page load and a back button. Items
 *   are already loaded with the sales (one query for all of them), so expanding
 *   costs nothing.
 * - Expanded state is client-side and deliberately not in the URL. It is a
 *   glance, not a destination worth a shareable link.
 * - Sale numbers can be null — the schema only requires one once a sale is
 *   completed — so every display goes through a fallback. Drafts have no number
 *   by design.
 * - Payments show where the money landed. A payment has no single sale_id any
 *   more, so "cleared INV-0007 and part of INV-0008" comes from its allocation
 *   rows, and anything unallocated is named as credit rather than left as an
 *   unexplained gap.
 */

'use client';

import { Fragment, useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SaleLinesEditor } from '@/features/sales/components/SaleLinesEditor';
import { PaymentRowActions } from '@/features/payments/components/PaymentRowActions';
import type { PickerProduct } from '@/features/sales/components/ProductPicker';
import { PAYMENT_METHOD_LABELS } from '@/features/payments/labels';
import { voidSaleAction } from '@/app/actions/sales';
import { ROUTES } from '@/lib/constants/routes';
import { formatDate, formatMoney } from '@/lib/utils/format';
import type { CustomerPaymentRow, CustomerSaleRow } from '../history';

interface CustomerSalesHistoryProps {
  sales: CustomerSaleRow[];
  customerId: string;
  /** Active catalog products, for the line editor inside an expanded row. */
  products: PickerProduct[];
  /** Manager and above: may correct lines on a recorded sale. */
  canEdit: boolean;
  /** Admin and above: may remove a transaction entirely. */
  canDelete: boolean;
  /** True when the line-item read failed; totals are still correct. */
  itemsUnavailable?: boolean;
}

export function CustomerSalesHistory({
  sales,
  customerId,
  products,
  canEdit,
  canDelete,
  itemsUnavailable,
}: CustomerSalesHistoryProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = (saleId: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(saleId)) next.delete(saleId);
      else next.add(saleId);
      return next;
    });
  };

  const voidSale = (sale: CustomerSaleRow) => {
    const confirmed = window.confirm(
      `Delete ${sale.sale_number ?? 'this draft sale'} for ${formatMoney(sale.total)}?\n\n` +
        `The stock goes back on the shelf and this customer's balance drops by ${formatMoney(sale.amount_due)}. ` +
        `Any payments that were covering it become credit on their account.\n\n` +
        `The transaction stays on file but leaves every list. This cannot be undone here.`
    );

    if (!confirmed) return;

    setError(null);

    startTransition(async () => {
      const result = await voidSaleAction(sale.id, customerId);
      if (!result.success) setError(result.error);
    });
  };

  if (sales.length === 0) {
    return (
      <p className="px-6 pb-6 text-sm text-muted-foreground">
        Nothing bought on credit yet.
      </p>
    );
  }

  // colSpan has to cover the chevron, the four data columns, and the action
  // column when it is rendered, or the expanded panel stops short of the table.
  const columnCount = canDelete ? 6 : 5;

  return (
    <div className="space-y-3">
      {error && (
        <div className="px-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-px">
              <span className="sr-only">Expand</span>
            </TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Still due</TableHead>
            <TableHead>Status</TableHead>
            {canDelete && (
              <TableHead className="w-px">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {sales.map((sale) => {
            const isOpen = expanded.has(sale.id);

            return (
              <Fragment key={sale.id}>
                <TableRow>
                  <TableCell className="pr-0">
                    <button
                      type="button"
                      onClick={() => toggle(sale.id)}
                      aria-expanded={isOpen}
                      aria-controls={`sale-items-${sale.id}`}
                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {isOpen ? (
                        <ChevronDown className="size-4" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="size-4" aria-hidden="true" />
                      )}
                      <span className="sr-only">
                        {isOpen ? 'Hide' : 'Show'} what was on{' '}
                        {sale.sale_number ?? 'this sale'}
                      </span>
                    </button>
                  </TableCell>

                  <TableCell className="font-medium tabular-nums">
                    {sale.sale_number ? (
                      <Link
                        href={ROUTES.sales.detail(sale.id)}
                        className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {sale.sale_number}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Draft</span>
                    )}
                    {sale.status === 'cancelled' && (
                      <Badge variant="secondary" className="ml-2">
                        Cancelled
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(sale.sale_date)}
                    {/* An overdue date is the reason to chase someone, so it is
                        called out on the row rather than left to a report. */}
                    {sale.due_date && sale.amount_due > 0 && isOverdue(sale.due_date) && (
                      <span className="block text-xs text-destructive">
                        Due {formatDate(sale.due_date)}
                      </span>
                    )}
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
                    <PaymentStatusBadge status={sale.payment_status} />
                  </TableCell>

                  {canDelete && (
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isPending}
                          onClick={() => voidSale(sale)}
                        >
                          <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                          <span className="sr-only">
                            Delete {sale.sale_number ?? 'this sale'}
                          </span>
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>

                {isOpen && (
                  <TableRow
                    // The panel is part of the row above it, not a hoverable row
                    // of its own.
                    className="hover:bg-transparent"
                  >
                    <TableCell colSpan={columnCount} className="bg-muted/20 p-0">
                      <div id={`sale-items-${sale.id}`} className="py-2">
                        <SaleLinesEditor
                          saleId={sale.id}
                          lines={sale.items}
                          products={products}
                          // A cancelled sale is a record of something reversed.
                          // Editing its lines would move stock for goods that
                          // came back, so it stays read-only.
                          canEdit={canEdit && sale.status !== 'cancelled'}
                          unavailable={itemsUnavailable}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

interface CustomerPaymentsHistoryProps {
  payments: CustomerPaymentRow[];
  customerId: string;
  /** Manager and above: may correct or void a payment. */
  canEdit: boolean;
}

export function CustomerPaymentsHistory({
  payments,
  customerId,
  canEdit,
}: CustomerPaymentsHistoryProps) {
  if (payments.length === 0) {
    return (
      <p className="px-6 pb-6 text-sm text-muted-foreground">
        No payments recorded yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Receipt</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Method</TableHead>
          <TableHead>Went to</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          {canEdit && (
            <TableHead className="w-px">
              <span className="sr-only">Actions</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell className="align-top font-medium tabular-nums">
              {payment.payment_number}
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

            {/* Where the money landed. Without this a payment reads as a number
                with no relationship to the invoices above it. */}
            <TableCell className="align-top text-sm">
              {payment.allocations.length === 0 ? (
                <span className="text-muted-foreground">Held as credit</span>
              ) : (
                <ul className="space-y-0.5">
                  {payment.allocations.map((allocation) => (
                    <li key={allocation.sale_id} className="text-xs">
                      <Link
                        href={ROUTES.sales.detail(allocation.sale_id)}
                        className="tabular-nums hover:underline"
                      >
                        {allocation.sale_number ?? 'Draft'}
                      </Link>
                      <span className="text-muted-foreground">
                        {' '}
                        {formatMoney(allocation.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {payment.unallocated_amount > 0 && payment.allocations.length > 0 && (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {formatMoney(payment.unallocated_amount)} left as credit
                </span>
              )}
            </TableCell>

            <TableCell className="align-top text-right font-medium tabular-nums text-emerald-700">
              {formatMoney(payment.amount)}
            </TableCell>

            {canEdit && (
              <TableCell className="align-top">
                <PaymentRowActions
                  payment={payment}
                  customerId={customerId}
                  canEdit={canEdit}
                />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PaymentStatusBadge({ status }: { status: CustomerSaleRow['payment_status'] }) {
  switch (status) {
    case 'paid':
      return <Badge variant="success">Paid</Badge>;
    case 'partial':
      return <Badge variant="warning">Part paid</Badge>;
    case 'unpaid':
      return <Badge variant="outline">Unpaid</Badge>;
  }
}

/** Past its due date, ignoring the time of day. */
function isOverdue(dueDate: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}
