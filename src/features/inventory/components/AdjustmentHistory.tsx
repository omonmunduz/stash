/**
 * ADJUSTMENT HISTORY
 *
 * Recent manual movements for one product or item, read beneath the adjust form.
 *
 * The log is append-only, so this is genuinely a record rather than a view of
 * mutable rows — a mistaken adjustment shows up as two lines, the error and its
 * correction. That is the point, and the reason nothing here offers an edit.
 *
 * Sales are absent by design: an invoice already explains why stock left, and
 * mixing the two would bury the handful of movements someone actually needs to
 * account for under every transaction of the day.
 */

import { Badge } from '@/components/ui/badge';
import type { InventoryAdjustment } from '../types';
import { ADJUSTMENT_REASON_LABELS } from '../labels';
import { formatQuantity, formatRelative } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface AdjustmentHistoryProps {
  adjustments: InventoryAdjustment[];
  unitOfMeasure: string;
}

export function AdjustmentHistory({
  adjustments,
  unitOfMeasure,
}: AdjustmentHistoryProps) {
  if (adjustments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No manual changes recorded yet. Deliveries, damage, and counts will appear
        here.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {adjustments.map((adjustment) => (
        <li
          key={adjustment.id}
          className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {ADJUSTMENT_REASON_LABELS[adjustment.reason]}
              </span>
              {adjustment.reason === 'count_correction' && (
                <Badge variant="outline" className="text-xs">
                  Recount
                </Badge>
              )}
            </div>

            {adjustment.notes && (
              <p className="mt-0.5 break-words text-sm text-muted-foreground">
                {adjustment.notes}
              </p>
            )}

            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatRelative(adjustment.adjusted_at)}
            </p>
          </div>

          {/* Delta leads, since "what changed" is the question being asked; the
              resulting figure sits under it for anyone reconciling a run of them. */}
          <div className="shrink-0 text-right">
            <span
              className={cn(
                'text-sm font-medium tabular-nums',
                adjustment.quantity_delta < 0
                  ? 'text-destructive'
                  : 'text-foreground'
              )}
            >
              {adjustment.quantity_delta > 0 ? '+' : '−'}
              {formatQuantity(Math.abs(adjustment.quantity_delta))}
            </span>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatQuantity(adjustment.quantity_after)} {unitOfMeasure}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
