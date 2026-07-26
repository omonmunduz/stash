/**
 * Onboarding layout.
 *
 * Wraps the onboarding flow (/onboarding/*).
 *
 * Design decisions:
 * - Simple centered shell, no sidebar or nav — onboarding is linear and should
 *   not offer escape routes into a half-configured app.
 * - No AuthProvider: /onboarding/setup runs before the organization exists, so
 *   there is no 'authenticated' state to seed it with.
 * - No guard in this layout, deliberately. The steps have opposing
 *   requirements: /setup demands the user have NO organization, while every
 *   later step demands one. A single shared guard cannot express both, so each
 *   page calls the guard it needs (requireOnboardingUser or requireActiveUser).
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Getting Started',
    template: '%s · Stash',
  },
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
