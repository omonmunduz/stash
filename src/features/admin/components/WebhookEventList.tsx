/**
 * WEBHOOK EVENT LIST (Admin View)
 *
 * Displays webhook events with processing status.
 */

import { Badge } from '@/components/ui/badge';
import type { WebhookEvent } from '@/features/billing/types';

interface WebhookEventListProps {
  events: WebhookEvent[];
}

export function WebhookEventList({ events }: WebhookEventListProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No webhook events received</p>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div
          key={event.id}
          className="space-y-2 border-b pb-3 last:border-0"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">
                {event.event_type || 'Unknown'}
              </p>
              {event.signature_valid === true && (
                <Badge variant="default">Verified</Badge>
              )}
              {event.signature_valid === false && (
                <Badge variant="destructive">Invalid Signature</Badge>
              )}
              {event.processed && (
                <Badge variant="outline">Processed</Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(event.received_at).toLocaleString()}
            </span>
          </div>

          {event.gateway_request_id && (
            <p className="text-xs text-muted-foreground">
              Request ID: {event.gateway_request_id}
            </p>
          )}

          {event.error_message && (
            <p className="text-xs text-destructive">
              Error: {event.error_message}
            </p>
          )}

          {event.processed_at && (
            <p className="text-xs text-green-600">
              Processed: {new Date(event.processed_at).toLocaleString()}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
