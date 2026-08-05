/**
 * DASHBOARD NOT-FOUND BOUNDARY
 *
 * Rendered when a dashboard page calls notFound(), which in this app means a
 * record was asked for by id and the service returned "not found". That covers
 * two situations the user cannot tell apart and does not need to: the id never
 * existed, or it belongs to another organization and RLS correctly hid it.
 *
 * Kept deliberately vague about which. Saying "that customer belongs to someone
 * else" would confirm the record exists to whoever guessed the id, so a
 * cross-tenant id reads exactly like a typo. The service layer already takes this
 * position — see the tenancy check in CustomerService.getById.
 *
 * Placed at the route-group root so it inherits the dashboard chrome: the user
 * keeps the sidebar and can navigate on rather than hitting a dead end.
 */

import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants/routes';

export default function DashboardNotFound() {
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <EmptyState
        icon={<FileQuestion className="h-10 w-10" aria-hidden="true" />}
        title="We couldn't find that"
        description="It may have been deleted, or the link might be wrong. Nothing has been changed."
        action={
          <Button asChild variant="outline">
            <Link href={ROUTES.dashboard.home}>Back to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
