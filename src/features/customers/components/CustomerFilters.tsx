/**
 * CUSTOMER SEARCH AND FILTERS
 *
 * State lives in the URL, not in this component. That means a filtered list is
 * shareable and survives a refresh or a back navigation, and the page stays a
 * Server Component doing the query — no client-side fetch, no loading spinner
 * over the table.
 *
 * The search box is debounced because every keystroke would otherwise trigger a
 * server round trip. 300ms is short enough to feel immediate and long enough
 * that typing a name is one request rather than eight.
 */

'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils/cn';

export function CustomerFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get('q') ?? '';
  const showsDebtorsOnly = searchParams.get('debt') === '1';
  const showsInactive = searchParams.get('status') === 'inactive';

  const [search, setSearch] = useState(currentSearch);

  /**
   * Rebuild the query string from the current params so filters compose
   * (searching within "owes money" keeps both), and drop empty values so the
   * URL stays readable.
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
    return query ? `${ROUTES.customers.list}?${query}` : ROUTES.customers.list;
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

  const hasFilters = currentSearch !== '' || showsDebtorsOnly || showsInactive;

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
          placeholder="Search by name, shop, or phone"
          className="pl-9"
          aria-label="Search customers"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          active={showsDebtorsOnly}
          onClick={() => navigate({ debt: showsDebtorsOnly ? null : '1' })}
        >
          Owes money
        </FilterChip>

        <FilterChip
          active={showsInactive}
          onClick={() => navigate({ status: showsInactive ? null : 'inactive' })}
        >
          Inactive
        </FilterChip>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              startTransition(() => router.replace(ROUTES.customers.list, { scroll: false }));
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

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background hover:bg-accent'
      )}
    >
      {children}
    </button>
  );
}
