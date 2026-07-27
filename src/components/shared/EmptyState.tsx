/**
 * EmptyState — what a list shows when it has nothing to show.
 *
 * Deliberately distinguishes two situations the UI must not conflate:
 * a genuinely empty dataset ("add your first customer") versus filters that
 * matched nothing ("no results for that search"). Showing a "get started" call
 * to action to someone whose search simply missed is confusing, so callers pass
 * different copy for each case.
 */

import { cn } from '@/lib/utils/cn';

interface EmptyStateProps {
  title: string;
  description?: string;
  /** Optional call to action, e.g. a "Add customer" button. */
  action?: React.ReactNode;
  /** Optional lucide icon element rendered above the title. */
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center',
        className
      )}
    >
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
