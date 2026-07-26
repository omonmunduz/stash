/**
 * Preferences page (Step 3 of onboarding).
 *
 * This is a placeholder — the full preferences form (currency, timezone, language)
 * will be built as part of the onboarding feature implementation.
 *
 * For now, just show a success message and link to dashboard.
 */

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants/routes';
import { requireActiveUser } from '@/features/auth/guards';

export const metadata = {
  title: 'Business preferences',
  description: 'Configure your business settings',
};

export default async function OnboardingPreferencesPage() {
  // Unlike /setup, this step runs AFTER the organization exists, so it needs the
  // standard guard. A user who lands here without an org is sent back to setup.
  const user = await requireActiveUser();

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="mb-2 text-sm text-muted-foreground">Step 2 of 5</div>
        <CardTitle className="text-2xl font-bold">Business preferences</CardTitle>
        <CardDescription>
          {user.organization.name} is set up. Next, configure your currency and
          timezone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The full preferences form is part of the onboarding feature, not this
          task. You can continue to the dashboard for now.
        </p>
        <Button asChild className="w-full">
          <Link href={ROUTES.dashboard.home}>Continue to dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
