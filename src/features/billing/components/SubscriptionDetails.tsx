/**
 * SUBSCRIPTION DETAILS
 *
 * Displays current subscription plan and status.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BillingStatusBadge } from './BillingStatusBadge';
import type { SubscriptionWithPlan } from '../types';

interface SubscriptionDetailsProps {
  subscription: SubscriptionWithPlan;
}

export function SubscriptionDetails({ subscription }: SubscriptionDetailsProps) {
  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  const getDaysRemaining = (date: Date | string | null) => {
    if (!date) return null;
    const end = new Date(date);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const periodEnd = subscription.current_period_end;
  const daysRemaining = getDaysRemaining(periodEnd);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>
              {subscription.plan?.name || 'No plan'}
            </CardDescription>
          </div>
          <BillingStatusBadge status={subscription.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Price */}
        {subscription.plan && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Price</span>
            <span className="text-lg font-semibold">
              {Number(subscription.plan.price_kgs).toFixed(2)} KGS/month
            </span>
          </div>
        )}

        {/* Trial End Date */}
        {subscription.status === 'trial' && subscription.trial_ends_at && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Trial Ends</span>
            <span className="text-sm font-medium">
              {formatDate(subscription.trial_ends_at)}
            </span>
          </div>
        )}

        {/* Current Period */}
        {subscription.status !== 'trial' && periodEnd && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Paid Until</span>
              <span className="text-sm font-medium">
                {formatDate(periodEnd)}
              </span>
            </div>

            {daysRemaining !== null && daysRemaining > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Days Remaining</span>
                <span className="text-sm font-medium">
                  {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                </span>
              </div>
            )}
          </>
        )}

        {/* Plan Features */}
        {subscription.plan && Array.isArray(subscription.plan.features) && subscription.plan.features.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Features</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {subscription.plan.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
