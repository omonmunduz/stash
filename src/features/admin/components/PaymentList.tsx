/**
 * PAYMENT LIST (Admin View)
 *
 * Displays payment records with admin details.
 */

import { Badge } from '@/components/ui/badge';
import type { PaymentWithInvoice } from '@/features/billing/types';

interface PaymentListProps {
  payments: PaymentWithInvoice[];
}

export function PaymentList({ payments }: PaymentListProps) {
  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No payments yet</p>
    );
  }

  return (
    <div className="space-y-3">
      {payments.map((payment) => (
        <div
          key={payment.id}
          className="flex items-center justify-between border-b pb-3 last:border-0"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">
                {payment.invoice.invoice_number}
              </p>
              <Badge variant={payment.paid_via === 'webhook' ? 'default' : 'secondary'}>
                {payment.paid_via === 'webhook' ? 'Automatic' : 'Manual'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(payment.paid_at).toLocaleDateString()} •
              Period: {new Date(payment.invoice.period_start).toLocaleDateString()} - {new Date(payment.invoice.period_end).toLocaleDateString()}
            </p>
            {payment.gateway_transaction_id && (
              <p className="text-xs text-muted-foreground">
                Transaction: {payment.gateway_transaction_id}
              </p>
            )}
            {payment.marked_paid_by && payment.admin_note && (
              <p className="text-xs text-orange-600">
                Manual: {payment.admin_note}
              </p>
            )}
          </div>

          <span className="text-sm font-semibold">
            {Number(payment.amount_kgs).toFixed(2)} KGS
          </span>
        </div>
      ))}
    </div>
  );
}
