/**
 * Preferences page (Step 2 of onboarding).
 *
 * Configure currency and timezone for the organization.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OrganizationPreferencesForm } from '@/features/organizations/components/OrganizationPreferencesForm';
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
          {user.organization.name} is set up. Configure your currency and timezone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <OrganizationPreferencesForm settings={user.organization.settings} />
      </CardContent>
    </Card>
  );
}
