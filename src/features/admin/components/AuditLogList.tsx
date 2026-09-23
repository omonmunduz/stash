/**
 * AUDIT LOG LIST (Admin View)
 *
 * Displays admin audit trail.
 */

import { Badge } from '@/components/ui/badge';
import type { AdminAuditLog } from '@/features/billing/types';

interface AuditLogListProps {
  logs: AdminAuditLog[];
}

export function AuditLogList({ logs }: AuditLogListProps) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No admin actions yet</p>
    );
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'mark_paid': return 'Marked Invoice Paid';
      case 'extend_period': return 'Extended Period';
      case 'change_plan': return 'Changed Plan';
      case 'suspend': return 'Suspended';
      case 'reactivate': return 'Reactivated';
      case 'cancel': return 'Cancelled';
      case 'grant_subscription': return 'Granted Subscription';
      default: return action;
    }
  };

  const getActionVariant = (action: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (action) {
      case 'suspend':
      case 'cancel':
        return 'destructive';
      case 'reactivate':
      case 'grant_subscription':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div
          key={log.id}
          className="space-y-2 border-b pb-3 last:border-0"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={getActionVariant(log.action)}>
                {getActionLabel(log.action)}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(log.created_at).toLocaleString()}
            </span>
          </div>

          {log.note && (
            <p className="text-sm text-muted-foreground">
              Note: {log.note}
            </p>
          )}

          {log.details && Object.keys(log.details).length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                Details
              </summary>
              <pre className="mt-2 rounded bg-muted p-2 text-xs overflow-x-auto">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
