/**
 * CATEGORY BREAKDOWN
 *
 * Where the money went, biggest first. The one thing a list of expenses cannot
 * tell you by being read top to bottom.
 *
 * Bars rather than a pie chart, and no charting library. A bar is a div with a
 * width, it works at any size without a client bundle, and comparing lengths
 * against a shared left edge is easier than comparing wedge angles. This is also
 * a Server Component as a result — a chart library would have forced 'use client'
 * onto a page that has no interaction on it.
 *
 * The bar is aria-hidden and purely decorative. Every figure it encodes is
 * already written next to it as text, so a screen reader gets the numbers rather
 * than a description of a rectangle.
 *
 * Percentages come from summarizeByCategory in business-rules, which computes
 * them against the grand total of the rows it was given. That means they always
 * sum to 100% of what is on screen rather than of all time.
 */

import { Badge } from '@/components/ui/badge';
import type { ExpenseSummary } from '../types';
import { formatMoney } from '@/lib/utils/format';

interface CategoryBreakdownProps {
  /** Sorted descending by total — summarizeByCategory already does this. */
  summary: ExpenseSummary[];
}

export function CategoryBreakdown({ summary }: CategoryBreakdownProps) {
  if (summary.length === 0) return null;

  // Bars are scaled against the largest category, not against the total. Scaling
  // to the total makes every bar short as soon as spending is spread across a few
  // categories, which is exactly when the comparison matters most.
  const largest = summary[0].total;

  return (
    <section aria-labelledby="breakdown-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="breakdown-heading" className="text-lg font-medium">
          By category
        </h2>
        <p className="text-sm text-muted-foreground">
          {summary.length === 1
            ? 'One category.'
            : `${summary.length} categories, largest first.`}
        </p>
      </div>

      <ul className="space-y-3">
        {summary.map((row) => (
          <li key={row.category} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="secondary" className="shrink-0">
                  {row.category}
                </Badge>
                <span className="truncate text-xs text-muted-foreground">
                  {row.count} {row.count === 1 ? 'expense' : 'expenses'}
                </span>
              </div>

              <div className="shrink-0 text-right">
                <span className="font-medium tabular-nums">
                  {formatMoney(row.total)}
                </span>
                <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                  {formatShare(row.percentage_of_total)}
                </span>
              </div>
            </div>

            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${barWidth(row.total, largest)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Internals ─────────────────────────────────────────────────────────────────

/**
 * A category's share as a percentage of the largest one, floored at 1.5%.
 *
 * Without the floor a category worth a rounding error against the biggest one
 * renders as an invisible bar, which reads as a rendering bug rather than as a
 * small number. The figure beside it is the accurate one.
 */
function barWidth(total: number, largest: number): number {
  if (largest <= 0) return 0;
  return Math.max(1.5, (total / largest) * 100);
}

/**
 * Shares round to whole numbers, except below 1% where rounding would print "0%"
 * next to a real amount of money.
 */
function formatShare(percentage: number): string {
  if (percentage > 0 && percentage < 1) return '<1%';
  return `${Math.round(percentage)}%`;
}
