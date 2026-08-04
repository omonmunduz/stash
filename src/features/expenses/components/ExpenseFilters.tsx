/**
 * EXPENSE FILTERS
 *
 * State lives in the URL, like PaymentFilters and CustomerFilters, so a filtered
 * view survives a refresh and the page stays a Server Component doing the query.
 *
 * The date range is a set of presets rather than two date inputs. The question
 * behind this screen is "what did I spend this month" — assembling a range to ask
 * that is work the app should be doing, and it is one tap instead of two pickers
 * on a phone. The presets are longer than the payments day book's for the reason
 * given in categories.ts: costs arrive in ones and twos, and a week of them is
 * often an empty page.
 *
 * The category list is passed in rather than taken from
 * EXPENSE_CATEGORY_SUGGESTIONS. Filtering by a suggestion nobody has used yet
 * would return an empty page, and a business whose costs we did not anticipate
 * would find its own categories missing from its own filter. The page reads the
 * distinct categories actually on file and hands them down.
 *
 * The search box is debounced at 300ms, matching CustomerFilters — enough that
 * typing a vendor name is one request rather than eight.
 */

'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants/routes';
import { PAYMENT_METHOD_LABELS } from '@/features/payments/labels';
import type { PaymentMethod } from '@/features/payments/types';
import {
  DEFAULT_EXPENSE_PERIOD,
  EXPENSE_PERIODS,
  parseExpensePeriod,
} from '../categories';
import { cn } from '@/lib/utils/cn';

interface ExpenseFiltersProps {
  /** Distinct categories on file for this organization, alphabetical. */
  categories: readonly string[];
}

export function ExpenseFilters({ categories }: ExpenseFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Parsed rather than cast so a hand-edited query string cannot leave a chip
  // looking selected while the page below it queried something else.
  const currentPeriod = parseExpensePeriod(searchParams.get('period') ?? undefined);
  const currentCategory = searchParams.get('category') ?? '';
  const currentMethod = searchParams.get('method') ?? '';
  const currentSearch = searchParams.get('q') ?? '';

  const [search, setSearch] = useState(currentSearch);

  /** Rebuild from current params so the filters compose. */
  const buildHref = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const query = params.toString();
    return query ? `${ROUTES.expenses.list}?${query}` : ROUTES.expenses.list;
  };

  const navigate = (changes: Record<string, string | null>) => {
    startTransition(() => router.replace(buildHref(changes), { scroll: false }));
  };

  // Skipping the navigation when the value already matches the URL stops this
  // firing on mount and on back-navigation, which would otherwise overwrite
  // history with an identical entry.
  useEffect(() => {
    if (search === currentSearch) return;

    const timer = setTimeout(() => navigate({ q: search || null }), 300);
    return () => clearTimeout(timer);
    // navigate is recreated each render; depending on it would reset the timer on
    // every keystroke's re-render and the debounce would never elapse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, currentSearch]);

  // The default period is what the page shows unfiltered, so there is nothing to
  // clear back to.
  const hasFilters =
    currentPeriod !== DEFAULT_EXPENSE_PERIOD ||
    currentCategory !== '' ||
    currentMethod !== '' ||
    currentSearch !== '';

  const clearAll = () => {
    setSearch('');
    startTransition(() => router.replace(ROUTES.expenses.list, { scroll: false }));
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search what it was for, who you paid, or the category"
          className="pl-9"
          aria-label="Search expenses"
        />
      </div>

      {/* Radio group rather than chips: the periods are mutually exclusive, and
          picking two would mean the same as picking neither. */}
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
            // The default period is expressed as an absent param, so a fresh
            // /expenses and an explicitly-chosen "This month" are one URL.
            onClick={() =>
              navigate({ period: value === DEFAULT_EXPENSE_PERIOD ? null : value })
            }
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
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Rendered only when there is something to choose. A select holding
            nothing but "Any" is a control that cannot do anything. */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="category-filter" className="text-sm text-muted-foreground">
              Category
            </label>
            <select
              id="category-filter"
              value={currentCategory}
              onChange={(event) => navigate({ category: event.target.value || null })}
              className="h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Any</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label htmlFor="method-filter" className="text-sm text-muted-foreground">
            Method
          </label>
          <select
            id="method-filter"
            value={currentMethod}
            onChange={(event) => navigate({ method: event.target.value || null })}
            className="h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Any</option>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((value) => (
              <option key={value} value={value}>
                {PAYMENT_METHOD_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X aria-hidden="true" />
            Clear
          </Button>
        )}

        {/* Announced because the table updates without a page navigation. */}
        <span className="sr-only" role="status" aria-live="polite">
          {isPending ? 'Updating results' : ''}
        </span>
      </div>
    </div>
  );
}
