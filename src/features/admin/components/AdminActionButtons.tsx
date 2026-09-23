/**
 * ADMIN ACTION BUTTONS
 *
 * Action buttons for super admin to manage subscriptions.
 * Client component that opens dialogs for each action.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { SubscriptionStatus } from '@/features/billing/types';

interface AdminActionButtonsProps {
  subscriptionId: string;
  organizationId: string;
  currentStatus: SubscriptionStatus;
}

export function AdminActionButtons({
  subscriptionId,
  organizationId,
  currentStatus,
}: AdminActionButtonsProps) {
  const [isLoading, setIsLoading] = useState(false);

  // TODO: Implement action handlers with dialogs
  const handleMarkPaid = () => {
    console.log('Mark invoice paid - TODO');
  };

  const handleExtendPeriod = () => {
    console.log('Extend period - TODO');
  };

  const handleChangePlan = () => {
    console.log('Change plan - TODO');
  };

  const handleGrantSubscription = () => {
    console.log('Grant subscription - TODO');
  };

  const handleSuspend = () => {
    console.log('Suspend - TODO');
  };

  const handleReactivate = () => {
    console.log('Reactivate - TODO');
  };

  const handleCancel = () => {
    console.log('Cancel - TODO');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Actions</CardTitle>
        <CardDescription>
          Manage this organization's subscription
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {/* Always available actions */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExtendPeriod}
            disabled={isLoading}
          >
            Extend Period
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleChangePlan}
            disabled={isLoading}
          >
            Change Plan
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGrantSubscription}
            disabled={isLoading}
          >
            Grant Subscription
          </Button>

          {/* Status-specific actions */}
          {(currentStatus === 'active' || currentStatus === 'past_due') && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleSuspend}
              disabled={isLoading}
            >
              Suspend
            </Button>
          )}

          {currentStatus === 'suspended' && (
            <Button
              variant="default"
              size="sm"
              onClick={handleReactivate}
              disabled={isLoading}
            >
              Reactivate
            </Button>
          )}

          {currentStatus !== 'cancelled' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel Subscription
            </Button>
          )}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Note: All actions will be logged in the audit trail with your user ID and required note.
        </p>
      </CardContent>
    </Card>
  );
}
