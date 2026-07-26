/**
 * ORGANIZATION SETUP FORM
 *
 * Step 2 of onboarding: create the organization.
 *
 * Design decisions:
 * - Only asks for organization name (slug auto-generated)
 * - Business type field from ONBOARDING.md is deferred to the preferences step
 * - This is the critical step that unlocks access to the rest of the app
 */

'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createOrganizationAction } from '@/app/actions/auth';

export function OrganizationSetupForm() {
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createOrganizationAction({ organizationName });

      if (!result.success) {
        setError(result.error);
      }
      // Success case: action redirects to next onboarding step
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="organizationName">Business name</Label>
        <Input
          id="organizationName"
          type="text"
          placeholder="e.g., Ali's Wholesale"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          disabled={isPending}
          required
          minLength={2}
          maxLength={100}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          This is how your business will appear throughout the app
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Creating...' : 'Continue'}
      </Button>
    </form>
  );
}
