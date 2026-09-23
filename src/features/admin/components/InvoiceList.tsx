/**
 * INVOICE LIST (Admin View)
 *
 * Displays invoices with admin-specific details.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Invoice } from '@/features/billing/types';
import { ExternalLink } from 'lucide-react';

interface InvoiceListProps {
  invoices: Invoice[];
}

export function InvoiceList({ invoices }: InvoiceListProps) {
  if (invoices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No invoices yet</p>
    );
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'default';
      case 'pending': return 'secondary';
      case 'failed': return 'destructive';
      case 'void': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-3">
      {invoices.map((invoice) => (
        <div
          key={invoice.id}
          className="flex items-center justify-between border-b pb-3 last:border-0"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{invoice.invoice_number}</p>
              <Badge variant={getStatusVariant(invoice.status)}>
                {invoice.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Due: {new Date(invoice.due_date).toLocaleDateString()} •
              Period: {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
            </p>
            {invoice.gateway_request_id && (
              <p className="text-xs text-muted-foreground">
                Request ID: {invoice.gateway_request_id}
              </p>
            )}
            {invoice.gateway_transaction_id && (
              <p className="text-xs text-muted-foreground">
                Transaction ID: {invoice.gateway_transaction_id}
              </p>
            )}
            {invoice.paid_at && (
              <p className="text-xs text-green-600">
                Paid: {new Date(invoice.paid_at).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">
              {Number(invoice.amount_kgs).toFixed(2)} KGS
            </span>
            {invoice.gateway_payment_url && invoice.status === 'pending' && (
              <a href={invoice.gateway_payment_url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
