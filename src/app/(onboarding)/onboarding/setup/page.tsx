/**
 * Onboarding setup page (Step 2).
 *
 * User creates their organization here.
 * This is the critical step that unlocks access to the rest of the app.
 *
 * Protected route: requires a session but NOT an existing organization.
 *
 * requireOnboardingUser() sends already-onboarded users to the dashboard. That
 * redirect is what stops this page from being replayed — without it, an owner
 * could revisit /onboarding/setup and create a second organization, and their
 * profile would still point at the first one.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OrganizationSetupForm } from '@/features/auth/components/OrganizationSetupForm';
import { requireOnboardingUser } from '@/features/auth/guards';

export const metadata = {
  title: 'Set up your business',
  description: 'Create your organization',
};

export default async function OnboardingSetupPage() {
  await requireOnboardingUser();

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="mb-2 text-sm text-muted-foreground">Step 1 of 5</div>
        <CardTitle className="text-2xl font-bold">Set up your business</CardTitle>
        <CardDescription>
          Tell us about your business to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <OrganizationSetupForm />
      </CardContent>
    </Card>
  );
}
