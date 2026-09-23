/**
 * SUPER ADMIN DASHBOARD - MAIN PAGE
 *
 * Overview of all organizations with billing status.
 * Filterable list with search and pagination.
 */

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDashboardSummary, getOrganizationsBilling } from '@/features/admin/service';
import { BillingStatusBadge } from '@/features/billing/components/BillingStatusBadge';

export const metadata = {
  title: 'Admin Dashboard',
  description: 'Platform administration',
};

interface PageProps {
  searchParams: {
    status?: string;
    search?: string;
    page?: string;
  };
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const page = parseInt(searchParams.page || '1', 10);
  const summary = await getDashboardSummary();

  const { data: organizations, total } = await getOrganizationsBilling(
    {
      status: searchParams.status as any,
      search: searchParams.search,
    },
    page,
    100
  );

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Organizations</CardDescription>
            <CardTitle className="text-3xl">{summary.total_organizations}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Subscriptions</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {summary.active_subscriptions}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overdue</CardDescription>
            <CardTitle className="text-3xl text-destructive">
              {summary.overdue_count}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Revenue This Month</CardDescription>
            <CardTitle className="text-3xl">
              {summary.revenue_this_month.toFixed(0)} KGS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Last month: {summary.revenue_last_month.toFixed(0)} KGS
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Organizations</CardTitle>
              <CardDescription>
                {total} total organizations
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Link href="/admin?status=trial">
                <Button variant="outline" size="sm">
                  Trials ({summary.trial_subscriptions})
                </Button>
              </Link>
              <Link href="/admin?status=past_due">
                <Button variant="outline" size="sm">
                  Past Due ({summary.past_due_subscriptions})
                </Button>
              </Link>
              <Link href="/admin?status=suspended">
                <Button variant="outline" size="sm">
                  Suspended ({summary.suspended_subscriptions})
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Organizations Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">Business</th>
                  <th className="pb-3 font-medium">Owner</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Plan</th>
                  <th className="pb-3 font-medium">Paid Until</th>
                  <th className="pb-3 font-medium">Days Left</th>
                  <th className="pb-3 font-medium">Last Payment</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {organizations.map((org) => {
                  const daysLeft = org.days_until_due;
                  const isExpiring = daysLeft !== null && daysLeft <= 7 && daysLeft > 0;
                  const isOverdue = daysLeft !== null && daysLeft < 0;

                  return (
                    <tr key={org.organization_id} className="text-sm">
                      <td className="py-3">
                        <div>
                          <p className="font-medium">{org.organization_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(org.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </td>
                      <td className="py-3">
                        <div>
                          <p>{org.owner_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {org.owner_email}
                          </p>
                        </div>
                      </td>
                      <td className="py-3">
                        <BillingStatusBadge status={org.subscription_status} />
                      </td>
                      <td className="py-3">
                        {org.plan_name ? (
                          <div>
                            <p>{org.plan_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {org.plan_price?.toFixed(0)} KGS/mo
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3">
                        {org.current_period_end ? (
                          <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                            {new Date(org.current_period_end).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3">
                        {daysLeft !== null ? (
                          <span
                            className={
                              isOverdue
                                ? 'font-medium text-destructive'
                                : isExpiring
                                ? 'font-medium text-orange-600'
                                : ''
                            }
                          >
                            {daysLeft > 0 ? `${daysLeft}d` : `${Math.abs(daysLeft)}d overdue`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3">
                        {org.last_payment_date ? (
                          <div>
                            <p>{new Date(org.last_payment_date).toLocaleDateString()}</p>
                            <p className="text-xs text-muted-foreground">
                              {org.last_payment_amount?.toFixed(0)} KGS
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No payments</span>
                        )}
                      </td>
                      <td className="py-3">
                        <Link href={`/admin/businesses/${org.organization_id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {organizations.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                No organizations found
              </div>
            )}
          </div>

          {/* Pagination */}
          {total > 100 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * 100 + 1} to {Math.min(page * 100, total)} of {total}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`/admin?page=${page - 1}`}>
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                )}
                {page * 100 < total && (
                  <Link href={`/admin?page=${page + 1}`}>
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
