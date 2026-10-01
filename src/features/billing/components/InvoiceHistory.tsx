/**
 * INVOICE HISTORY
 *
 * Displays all invoices for the organization.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getInvoicesByOrgId } from '../repository';

interface InvoiceHistoryProps {
  organizationId: string;
}

export async function InvoiceHistory({ organizationId }: InvoiceHistoryProps) {
  const invoices = await getInvoicesByOrgId(organizationId);

  if (invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>No invoices yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your invoice history will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'failed':
        return 'destructive';
      case 'void':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice History</CardTitle>
        <CardDescription>All invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {invoice.invoice_number}
                </p>
                <p className="text-xs text-muted-foreground">
                  Due: {new Date(invoice.due_date).toLocaleDateString()} • {' '}
                  Period: {new Date(invoice.period_start).toLocaleDateString()} -{' '}
                  {new Date(invoice.period_end).toLocaleDateString()}
                </p>
                {invoice.paid_at && (
                  <p className="text-xs text-muted-foreground">
                    Paid: {new Date(invoice.paid_at).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Badge variant={getStatusBadgeVariant(invoice.status)}>
                  {invoice.status}
                </Badge>
                <span className="text-sm font-semibold">
                  {Number(invoice.amount_kgs).toFixed(2)} KGS
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
