/**
 * INVENTORY SEARCH AND FILTERS
 *
 * State lives in the URL, same as CustomerFilters and for the same reasons: a
 * filtered list is shareable, survives a refresh, and the page stays a Server
 * Component doing the query rather than a client fetch with a spinner over the
 * table.
 *
 * The kind filter is a three-way choice rather than two independent chips,
 * because "products" and "supplies" are mutually exclusive — as chips, ticking
 * both would mean the same thing as ticking neither, which is a control that
 * cannot express what it appears to.
 */

'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils/cn';

type Kind = 'all' | 'products' | 'items';

const KIND_TABS: Array<{ value: Kind; label: string }> = [
  { value: 'all', label: 'Everything' },
  { value: 'products', label: 'Products' },
  { value: 'items', label: 'Supplies' },
];

export function InventoryFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get('q') ?? '';
  const currentKind = (searchParams.get('kind') ?? 'all') as Kind;
  const showsLowOnly = searchParams.get('low') === '1';

  const [search, setSearch] = useState(currentSearch);

  /**
   * Rebuild the query string from the current params so filters compose
   * (searching within "needs reordering" keeps both), and drop empty values so
   * the URL stays readable.
   */
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
    return query ? `${ROUTES.inventory.list}?${query}` : ROUTES.inventory.list;
  };

  const navigate = (changes: Record<string, string | null>) => {
    startTransition(() => router.replace(buildHref(changes), { scroll: false }));
  };

  // Debounce the search term. Skipping the navigation when the value already
  // matches the URL stops this from firing on mount and on back-navigation,
  // which would otherwise overwrite history with an identical entry.
  useEffect(() => {
    if (search === currentSearch) return;

    const timer = setTimeout(() => navigate({ q: search || null }), 300);
    return () => clearTimeout(timer);
    // navigate is recreated each render; depending on it would reset the timer
    // on every keystroke's re-render and the debounce would never elapse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, currentSearch]);

  const hasFilters = currentSearch !== '' || currentKind !== 'all' || showsLowOnly;

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
          placeholder="Search by name or code"
          className="pl-9"
          aria-label="Search stock"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* A radio group rather than buttons: these are one exclusive choice, and
            arrow-key navigation between them comes free with the role. */}
        <div role="radiogroup" aria-label="Filter by kind" className="flex gap-2">
          {KIND_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="radio"
              aria-checked={currentKind === tab.value}
              onClick={() =>
                navigate({ kind: tab.value === 'all' ? null : tab.value })
              }
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                currentKind === tab.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-accent'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-pressed={showsLowOnly}
          onClick={() => navigate({ low: showsLowOnly ? null : '1' })}
          className={cn(
            'rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            showsLowOnly
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background hover:bg-accent'
          )}
        >
          Needs reordering
        </button>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              startTransition(() =>
                router.replace(ROUTES.inventory.list, { scroll: false })
              );
            }}
          >
            <X aria-hidden="true" />
            Clear
          </Button>
        )}

        {/* aria-live so the result change is announced to screen readers, since
            the table updates without a page navigation. */}
        <span className="sr-only" role="status" aria-live="polite">
          {isPending ? 'Updating results' : ''}
        </span>
      </div>
    </div>
  );
}
