/**
 * BILLING PAGE
 *
 * Business-side billing dashboard showing subscription status,
 * open invoices with QR codes, and payment history.
 *
 * Accessible to all roles (read-only view of their org's billing).
 */

import { PageHeader } from '@/components/shared/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireAuth } from '@/features/auth/guards';
import { getBillingSummary } from '@/features/billing/service';
import { BillingStatusBadge } from '@/features/billing/components/BillingStatusBadge';
import { PaymentQRCode } from '@/features/billing/components/PaymentQRCode';
import { InvoiceHistory } from '@/features/billing/components/InvoiceHistory';
import { PaymentHistory } from '@/features/billing/components/PaymentHistory';
import { SubscriptionDetails } from '@/features/billing/components/SubscriptionDetails';

export const metadata = {
  title: 'Billing',
  description: 'Manage your subscription and payments',
};

export default async function BillingPage() {
  const user = await requireAuth();

  // Get billing summary
  const billingSummary = await getBillingSummary(user.organization_id);

  if (!billingSummary) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <PageHeader title="Billing" description="Manage your subscription and payments" />
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load billing information. Please contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { subscription, nextInvoice, recentPayments, daysUntilDue, isExpiring, isOverdue } = billingSummary;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Billing"
        description="Manage your subscription and payments"
      />

      {/* Alerts */}
      {isOverdue && (
        <Alert variant="destructive">
          <AlertDescription>
            Your subscription is overdue. Please make a payment to continue using the service.
          </AlertDescription>
        </Alert>
      )}

      {isExpiring && !isOverdue && (
        <Alert>
          <AlertDescription>
            Your subscription expires in {daysUntilDue} days. Please make a payment to avoid service interruption.
          </AlertDescription>
        </Alert>
      )}

      {subscription.status === 'suspended' && (
        <Alert variant="destructive">
          <AlertDescription>
            Your subscription is suspended due to non-payment. Please contact support or make a payment to reactivate.
          </AlertDescription>
        </Alert>
      )}

      {subscription.status === 'trial' && (
        <Alert>
          <AlertDescription>
            You are currently on a trial. Trial ends on {subscription.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleDateString() : 'N/A'}.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Subscription Overview */}
        <SubscriptionDetails subscription={subscription} />

        {/* Open Invoice / Payment */}
        {nextInvoice && (
          <Card>
            <CardHeader>
              <CardTitle>Open Invoice</CardTitle>
              <CardDescription>
                Invoice #{nextInvoice.invoice_number}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="text-2xl font-bold">
                  {Number(nextInvoice.amount_kgs).toFixed(2)} KGS
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Due Date</span>
                <span className="text-sm font-medium">
                  {new Date(nextInvoice.due_date).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={nextInvoice.status === 'pending' ? 'secondary' : 'default'}>
                  {nextInvoice.status}
                </Badge>
              </div>

              {/* QR Code for payment */}
              {nextInvoice.gateway_qr_code_url && (
                <PaymentQRCode
                  qrCodeUrl={nextInvoice.gateway_qr_code_url}
                  paymentUrl={nextInvoice.gateway_payment_url || undefined}
                  amount={Number(nextInvoice.amount_kgs)}
                />
              )}

              {!nextInvoice.gateway_qr_code_url && (
                <Alert>
                  <AlertDescription>
                    Payment link is being generated. Please refresh in a moment.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* No Open Invoice */}
        {!nextInvoice && subscription.status === 'active' && (
          <Card>
            <CardHeader>
              <CardTitle>No Open Invoice</CardTitle>
              <CardDescription>
                Your account is up to date
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your next invoice will be generated approximately 7 days before your renewal date.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Payments */}
      <PaymentHistory payments={recentPayments} />

      {/* Invoice History */}
      <InvoiceHistory organizationId={user.organization_id} />
    </div>
  );
}
