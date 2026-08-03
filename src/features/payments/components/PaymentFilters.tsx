/**
 * PAYMENT FILTERS
 *
 * State lives in the URL, like CustomerFilters and InventoryFilters, so a filtered
 * day book survives a refresh and the page stays a Server Component doing the query.
 *
 * The period control is a set of presets rather than two date inputs. The question
 * behind this screen is "how much came in today" or "what did I take this month" —
 * assembling a date range to ask that is work the app should be doing. Presets also
 * mean one tap instead of two pickers on a phone.
 *
 * No search box: the service has no search over receipt numbers, and looking up one
 * specific receipt is a thing you do from the customer's page, where you know whose
 * it was.
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants/routes';
import { PAYMENT_METHOD_LABELS } from '../labels';
import type { PaymentMethod } from '../types';
import {
  DEFAULT_PAYMENT_PERIOD,
  PAYMENT_PERIODS,
  parsePaymentPeriod,
} from '../periods';
import { cn } from '@/lib/utils/cn';

export function PaymentFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Parsed rather than cast so a hand-edited query string cannot leave a chip
  // looking selected while the page below it queried something else.
  const currentPeriod = parsePaymentPeriod(searchParams.get('period') ?? undefined);
  const currentMethod = searchParams.get('method') ?? '';

  /** Rebuild from current params so period and method compose. */
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
    return query ? `${ROUTES.payments.list}?${query}` : ROUTES.payments.list;
  };

  const navigate = (changes: Record<string, string | null>) => {
    startTransition(() => router.replace(buildHref(changes), { scroll: false }));
  };

  // The default period is what the page shows unfiltered, so it is not something
  // there is anything to clear back to.
  const hasFilters = currentPeriod !== DEFAULT_PAYMENT_PERIOD || currentMethod !== '';

  return (
    <div className="space-y-3">
      {/* Radio group rather than chips: the periods are mutually exclusive, and
          picking two would mean the same as picking neither. */}
      <div
        role="radiogroup"
        aria-label="Period"
        className="flex flex-wrap items-center gap-2"
      >
        {PAYMENT_PERIODS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={currentPeriod === value}
            // The default period is expressed as an absent param, so a fresh
            // /payments and an explicitly-chosen "This month" are one URL.
            onClick={() =>
              navigate({ period: value === DEFAULT_PAYMENT_PERIOD ? null : value })
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

      <div className="flex flex-wrap items-center gap-2">
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

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              startTransition(() =>
                router.replace(ROUTES.payments.list, { scroll: false })
              )
            }
          >
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
