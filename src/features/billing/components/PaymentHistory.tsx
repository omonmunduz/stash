/**
 * PAYMENT HISTORY
 *
 * Displays recent payment records.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PaymentWithInvoice } from '../types';

interface PaymentHistoryProps {
  payments: PaymentWithInvoice[];
}

export function PaymentHistory({ payments }: PaymentHistoryProps) {
  if (payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>No payments yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your payment history will appear here once you make your first payment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
        <CardDescription>Recent payments</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {payment.invoice.invoice_number}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(payment.paid_at).toLocaleDateString()} • {' '}
                  {new Date(payment.invoice.period_start).toLocaleDateString()} -{' '}
                  {new Date(payment.invoice.period_end).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant={payment.paid_via === 'webhook' ? 'default' : 'secondary'}>
                  {payment.paid_via === 'webhook' ? 'Automatic' : 'Manual'}
                </Badge>
                <span className="text-sm font-semibold">
                  {Number(payment.amount_kgs).toFixed(2)} KGS
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
