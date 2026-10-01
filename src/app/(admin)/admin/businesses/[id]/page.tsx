/**
 * SUPER ADMIN - ORGANIZATION DETAIL PAGE
 *
 * Detailed view of a single organization's billing status.
 * Allows super admin to perform actions: mark paid, extend period, etc.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getOrganizationDetail } from '@/features/admin/service';
import { BillingStatusBadge } from '@/features/billing/components/BillingStatusBadge';
import { AdminActionButtons } from '@/features/admin/components/AdminActionButtons';
import { InvoiceList } from '@/features/admin/components/InvoiceList';
import { PaymentList } from '@/features/admin/components/PaymentList';
import { WebhookEventList } from '@/features/admin/components/WebhookEventList';
import { AuditLogList } from '@/features/admin/components/AuditLogList';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrganizationDetailPage({ params }: PageProps) {
  const { id } = await params;

  try {
    const detail = await getOrganizationDetail(id);
    const { organization, subscription, invoices, payments, webhooks, auditLogs } = detail;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{organization.name}</h1>
              <p className="text-sm text-muted-foreground">
                ID: {organization.id}
              </p>
            </div>
          </div>
          <BillingStatusBadge status={subscription?.status || 'trial'} />
        </div>

        {/* Organization Info */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm font-medium">
                  {organization.created_at ? new Date(organization.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Slug</span>
                <span className="text-sm font-medium">{organization.slug}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="text-sm font-medium">
                  {subscription ? (
                    <BillingStatusBadge status={subscription.status} />
                  ) : (
                    <Badge variant="outline">No Subscription</Badge>
                  )}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subscription Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {subscription?.plan ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <span className="text-sm font-medium">{subscription.plan.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Price</span>
                    <span className="text-sm font-medium">
                      {Number(subscription.plan.price_kgs).toFixed(2)} KGS/month
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No plan assigned</p>
              )}

              {subscription?.current_period_end && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Period End</span>
                  <span className="text-sm font-medium">
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </span>
                </div>
              )}

              {subscription?.trial_ends_at && subscription.status === 'trial' && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Trial Ends</span>
                  <span className="text-sm font-medium">
                    {new Date(subscription.trial_ends_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Admin Actions */}
        {subscription && (
          <AdminActionButtons
            subscriptionId={subscription.id}
            organizationId={organization.id}
            currentStatus={subscription.status}
          />
        )}

        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>{invoices.length} total</CardDescription>
          </CardHeader>
          <CardContent>
            <InvoiceList invoices={invoices} />
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
            <CardDescription>{payments.length} total</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentList payments={payments} />
          </CardContent>
        </Card>

        {/* Webhook Events */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook Events</CardTitle>
            <CardDescription>{webhooks.length} events received</CardDescription>
          </CardHeader>
          <CardContent>
            <WebhookEventList events={webhooks} />
          </CardContent>
        </Card>

        {/* Audit Log */}
        <Card>
          <CardHeader>
            <CardTitle>Admin Audit Log</CardTitle>
            <CardDescription>{auditLogs.length} admin actions</CardDescription>
          </CardHeader>
          <CardContent>
            <AuditLogList logs={auditLogs} />
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load organization details: {error instanceof Error ? error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }
}
