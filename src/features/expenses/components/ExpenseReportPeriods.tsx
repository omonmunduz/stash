/**
 * EXPENSE REPORT PERIOD PICKER
 *
 * The period presets on their own, for the breakdown report.
 *
 * Separate from ExpenseFilters rather than a prop on it. That component carries a
 * search box, a category select and a method select, none of which the report has
 * anything to do with — a breakdown filtered to one category is a single bar, and
 * one filtered by a search term is a figure that cannot be checked against
 * anything. Passing four flags to hide three quarters of a component is a worse
 * seam than two components that each do one thing.
 *
 * The presets themselves come from categories.ts, shared with the list, so
 * "this month" cannot come to mean two different months on two screens.
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { ROUTES } from '@/lib/constants/routes';
import {
  DEFAULT_EXPENSE_PERIOD,
  EXPENSE_PERIODS,
  parseExpensePeriod,
} from '../categories';
import { cn } from '@/lib/utils/cn';

export function ExpenseReportPeriods() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Parsed rather than cast so a hand-edited query string cannot leave a chip
  // looking selected while the figures below it describe a different period.
  const currentPeriod = parseExpensePeriod(searchParams.get('period') ?? undefined);

  const select = (value: string) => {
    // The default is expressed as an absent param, so arriving fresh and
    // explicitly choosing "This month" are one URL.
    const href =
      value === DEFAULT_EXPENSE_PERIOD
        ? ROUTES.reports.expenses
        : `${ROUTES.reports.expenses}?period=${value}`;

    startTransition(() => router.replace(href, { scroll: false }));
  };

  return (
    <div
      role="radiogroup"
      aria-label="Period"
      className="flex flex-wrap items-center gap-2"
    >
      {EXPENSE_PERIODS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={currentPeriod === value}
          onClick={() => select(value)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            currentPeriod === value
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background hover:bg-accent'
          )}
        >
          {label}
        </button>
      ))}

      {/* Announced because the figures update without a page navigation. */}
      <span className="sr-only" role="status" aria-live="polite">
        {isPending ? 'Updating figures' : ''}
      </span>
    </div>
  );
}
