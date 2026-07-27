/**
 * CUSTOMER HISTORY TABLES
 *
 * Read-only sales and payment history for the detail page.
 *
 * Sale numbers can be null — the schema only requires one once a sale is
 * completed — so every display goes through a fallback rather than assuming a
 * string. Drafts have no number by design.
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatMoney } from '@/lib/utils/format';
import type { CustomerPaymentRow, CustomerSaleRow } from '../history';

const PAYMENT_METHOD_LABELS: Record<CustomerPaymentRow['payment_method'], string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  check: 'Check',
  other: 'Other',
};

export function CustomerSalesHistory({ sales }: { sales: CustomerSaleRow[] }) {
  if (sales.length === 0) {
    return (
      <p className="px-6 pb-6 text-sm text-muted-foreground">
        No completed sales yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Still due</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sales.map((sale) => (
          <TableRow key={sale.id}>
            <TableCell className="font-medium tabular-nums">
              {sale.sale_number ?? 'Draft'}
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
              <PaymentStatusBadge status={sale.payment_status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function CustomerPaymentsHistory({ payments }: { payments: CustomerPaymentRow[] }) {
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
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell className="font-medium tabular-nums">
              {payment.payment_number}
              {/* An unallocated payment sits against the customer's account
                  rather than a specific invoice. Worth surfacing: it is the
                  difference between "paid invoice 12" and "paid on account". */}
              {payment.sale_id === null && (
                <Badge variant="outline" className="ml-2">
                  On account
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDate(payment.payment_date)}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {PAYMENT_METHOD_LABELS[payment.payment_method]}
              {payment.reference_number && (
                <span className="block text-xs">{payment.reference_number}</span>
              )}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums text-emerald-700">
              {formatMoney(payment.amount)}
            </TableCell>
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
