'use client';

/**
 * DASHBOARD ERROR BOUNDARY
 *
 * What this catches: an uncaught throw while rendering any dashboard page. The
 * repositories throw on query failure by design (see the error policy on
 * SupabaseCustomerRepository) and the service layer converts most of those into
 * Result values — but not all of them. getAuthState throws outright when the
 * profile read fails, and any bug in a Server Component surfaces the same way.
 *
 * Without this file those throws bubble to the root, so a single failed query
 * blanks the entire application chrome and the only way back is a manual reload.
 * Scoped to the route group instead, the sidebar and header survive: the failure
 * is contained to the page body and the user can navigate away from it.
 *
 * Must be a Client Component. Next needs a component with an error boundary and
 * a reset callback, neither of which exists on the server.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { ROUTES } from '@/lib/constants/routes';

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    // In production, Next replaces the message with a generic string and gives
    // the real one a digest, so this is the only handle on which failure it was.
    // Logging to the console keeps it visible in Vercel's client logs without
    // committing to an error-reporting vendor the project has not chosen yet.
    console.error('Dashboard route error:', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <EmptyState
        icon={<AlertTriangle className="h-8 w-8" aria-hidden="true" />}
        title="Something went wrong loading this page"
        // No stack trace and no Postgres message. The audience is a shop owner,
        // and the production message would be a meaningless generic string
        // anyway. The digest is included because it is the one thing that makes
        // a support conversation actionable.
        description={
          error.digest
            ? `This is usually temporary. Try again, and if it keeps happening quote reference ${error.digest}.`
            : 'This is usually temporary. Try again in a moment.'
        }
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* reset() re-renders the segment without a full page load, so a
                transient query failure recovers in place. */}
            <Button onClick={reset}>Try again</Button>
            <Button variant="outline" asChild>
              <Link href={ROUTES.dashboard.home}>Back to dashboard</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
