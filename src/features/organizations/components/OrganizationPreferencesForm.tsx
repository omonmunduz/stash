/**
 * ORGANIZATION PREFERENCES FORM
 *
 * Configures currency and timezone for the organization.
 * Part of the onboarding flow (Step 2).
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { updateOrganizationPreferencesAction } from '@/app/actions/organization';
import { ROUTES } from '@/lib/constants/routes';

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar ($)', symbol: '$' },
  { code: 'EUR', label: 'Euro (€)', symbol: '€' },
  { code: 'GBP', label: 'British Pound (£)', symbol: '£' },
  { code: 'RUB', label: 'Russian Ruble (₽)', symbol: '₽' },
  { code: 'KES', label: 'Kenyan Shilling (KSh)', symbol: 'KSh' },
  { code: 'TZS', label: 'Tanzanian Shilling (TSh)', symbol: 'TSh' },
  { code: 'UGX', label: 'Ugandan Shilling (USh)', symbol: 'USh' },
  { code: 'NGN', label: 'Nigerian Naira (₦)', symbol: '₦' },
  { code: 'ZAR', label: 'South African Rand (R)', symbol: 'R' },
  { code: 'INR', label: 'Indian Rupee (₹)', symbol: '₹' },
  { code: 'AED', label: 'UAE Dirham (د.إ)', symbol: 'AED' },
];

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris, Madrid, Berlin' },
  { value: 'Europe/Moscow', label: 'Moscow, St. Petersburg' },
  { value: 'Africa/Cairo', label: 'Cairo' },
  { value: 'Africa/Nairobi', label: 'Nairobi, Kampala' },
  { value: 'Africa/Lagos', label: 'Lagos' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg, Cape Town' },
  { value: 'Asia/Dubai', label: 'Dubai, Abu Dhabi' },
  { value: 'Asia/Kolkata', label: 'Mumbai, Delhi, Bangalore' },
  { value: 'Asia/Shanghai', label: 'Beijing, Shanghai' },
  { value: 'Asia/Tokyo', label: 'Tokyo, Osaka' },
  { value: 'Australia/Sydney', label: 'Sydney, Melbourne' },
];

interface OrganizationPreferencesFormProps {
  /** Current organization settings */
  settings?: Record<string, unknown>;
}

export function OrganizationPreferencesForm({
  settings = {},
}: OrganizationPreferencesFormProps) {
  const currentCurrency = (settings.currency as string) || 'USD';
  const currentTimezone = (settings.timezone as string) || 'UTC';
  const router = useRouter();
  const [currency, setCurrency] = useState(currentCurrency);
  const [timezone, setTimezone] = useState(currentTimezone);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateOrganizationPreferencesAction({ currency, timezone });

      if (!result.success) {
        setError(result.error || 'An error occurred');
      } else {
        // Success - redirect to dashboard
        router.push(ROUTES.dashboard.home);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={isPending}
            required
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {CURRENCIES.map((curr) => (
              <option key={curr.code} value={curr.code}>
                {curr.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            All prices and reports will be shown in this currency.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={isPending}
            required
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Used for reports and appointment scheduling.
          </p>
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Saving...' : 'Continue to dashboard'}
      </Button>
    </form>
  );
}
