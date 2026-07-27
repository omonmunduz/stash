/**
 * SIGNUP FORM
 *
 * Client component for creating a new account.
 *
 * Design decisions:
 * - Full name is collected here because it's needed in Step 2 (org creation)
 * - Password requirements shown inline (min 8 chars, 1 number)
 * - Two possible outcomes, because the action has two:
 *     email confirmation ON  → no session, so the action returns
 *                              needsVerification and the form is replaced with
 *                              a "check your inbox" panel
 *     email confirmation OFF → session exists, so the action redirects to
 *                              onboarding and this component unmounts
 *   Ignoring the first case leaves the page visually unchanged after a
 *   successful submit, which reads as a silent failure.
 */

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { signUpAction } from '@/app/actions/auth';
import { ROUTES } from '@/lib/constants/routes';

export function SignupForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await signUpAction({ fullName, email, password });

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Reached only when confirmation is required. Otherwise the action has
      // already redirected and this callback never resumes.
      if (result.data.needsVerification) {
        setAwaitingVerification(true);
      }
    });
  };

  if (awaitingVerification) {
    return (
      <div className="space-y-4">
        {/* role="status" so screen readers announce the change — the visual
            swap alone is what the sighted user notices. */}
        <Alert variant="success" role="status">
          <AlertDescription className="space-y-2">
            <span className="block font-medium">Confirm your email to continue</span>
            <span className="block">
              We sent a confirmation link to <strong>{email}</strong>. Open it and
              you&apos;ll be signed in and taken to setup.
            </span>
            <span className="block text-xs">
              Nothing yet? Check your spam folder — the link can take a minute to
              arrive.
            </span>
          </AlertDescription>
        </Alert>

        <Button asChild variant="outline" className="w-full">
          <Link href={ROUTES.auth.login}>Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          type="text"
          placeholder="John Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={isPending}
          required
          autoComplete="name"
          minLength={2}
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isPending}
          required
          autoComplete="new-password"
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">
          Must be at least 8 characters and include a number
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Creating account...' : 'Create account'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href={ROUTES.auth.login} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
