/**
 * Dashboard home.
 *
 * Placeholder that proves the auth chain end to end. The real dashboard is a
 * separate task.
 *
 * No guard here: the (dashboard) layout already ran requireActiveUser(), so
 * reaching this component means an active, onboarded user. requireActiveUser()
 * is called again rather than passed down because layouts cannot pass props to
 * pages — the second call hits the same request-scoped Supabase session, not a
 * second round of auth.
 */

import { requireActiveUser } from '@/features/auth/guards';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants/routes';

export const metadata = {
  title: 'Dashboard',
  description: 'Business overview',
};

export default async function DashboardPage() {
  const user = await requireActiveUser();

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {user.fullName}</CardTitle>
          <CardDescription>
            You&apos;re signed in to {user.organization.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <h2 className="mb-2 font-semibold">Authentication is working</h2>
            <dl className="space-y-1 text-sm text-muted-foreground">
              <div className="flex gap-2">
                <dt>Email:</dt>
                <dd>{user.email}</dd>
              </div>
              <div className="flex gap-2">
                <dt>Organization:</dt>
                <dd>{user.organization.name}</dd>
              </div>
              <div className="flex gap-2">
                <dt>Role:</dt>
                <dd>{user.role}</dd>
              </div>
              <div className="flex gap-2">
                <dt>Organization ID:</dt>
                <dd className="font-mono text-xs">{user.organizationId}</dd>
              </div>
            </dl>
          </div>

          {/*
            POST to the logout route rather than calling a Server Action:
            sign-out must write cookies, and a POST can't be triggered by a
            link prefetch the way a GET can.
          */}
          <form action={ROUTES.auth.logout} method="post">
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
