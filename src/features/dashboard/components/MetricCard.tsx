/**
 * METRIC CARD
 *
 * One number on the home screen. Server Component: it renders a value that was
 * already fetched, so there is nothing to hydrate.
 *
 * A null value means the query failed, which is deliberately distinct from zero.
 * "0 owed" is good news; "we couldn't load what you're owed" is not, and showing
 * a dash for the second is more honest than showing a zero.
 */

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

export type MetricTone = 'default' | 'debt' | 'positive' | 'warning';

// Amber is literal rather than a --warning token because that token does not
// exist yet; Badge's warning variant uses literal amber too. Worth promoting to
// a token once a third consumer appears.
const TONE_STYLES: Record<MetricTone, string> = {
  default: 'text-foreground',
  debt: 'text-destructive',
  positive: 'text-success',
  warning: 'text-amber-600',
};

interface MetricCardProps {
  label: string;
  /** Pre-formatted value, or null when the underlying query failed. */
  value: string | null;
  /** Small line under the value giving the number context. */
  detail?: string;
  icon: LucideIcon;
  tone?: MetricTone;
  /** When set, the whole card becomes a link into the relevant list. */
  href?: string;
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'default',
  href,
}: MetricCardProps) {
  const unavailable = value === null;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>

      <p
        className={cn(
          'mt-3 text-2xl font-semibold tabular-nums tracking-tight',
          unavailable ? 'text-muted-foreground' : TONE_STYLES[tone]
        )}
      >
        {unavailable ? '—' : value}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        {unavailable ? "Couldn't load this right now" : detail}
      </p>

      {href && !unavailable ? (
        <ArrowUpRight
          className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  const shell =
    'group relative rounded-lg border border-border bg-card p-4 text-left shadow-sm';

  if (href && !unavailable) {
    return (
      <Link
        href={href}
        className={cn(
          shell,
          'block transition-colors hover:border-foreground/20 hover:bg-accent/40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        )}
      >
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}
