/**
 * BILLING STATUS BADGE
 *
 * Displays subscription status with appropriate styling.
 */

import { Badge } from '@/components/ui/badge';
import type { SubscriptionStatus } from '../types';

interface BillingStatusBadgeProps {
  status: SubscriptionStatus;
}

const statusConfig: Record<SubscriptionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  trial: { label: 'Trial', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
  past_due: { label: 'Past Due', variant: 'destructive' },
  suspended: { label: 'Suspended', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
};

export function BillingStatusBadge({ status }: BillingStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}
