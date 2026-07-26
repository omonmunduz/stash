/**
 * RESET PASSWORD FORM
 *
 * Requests a password-reset email.
 *
 * Design decisions:
 * - Always shows the same confirmation, whether or not the address has an
 *   account. Saying "no account found" would let anyone test which emails are
 *   registered.
 * - Replaces the form with the confirmation on success, so the user isn't left
 *   wondering whether to submit again.
 */

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { resetPasswordAction } from '@/app/actions/auth';
import { ROUTES } from '@/lib/constants/routes';

export function ResetPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await resetPasswordAction({ email });

      if (result.success) {
        setSent(true);
      } else {
        // Only genuine failures land here (malformed address, rate limit).
        // "Unknown email" is reported as success by design.
        setError(result.error);
      }
    });
  };

  if (sent) {
    return (
      <div className="space-y-4">
        <Alert variant="success">
          <AlertDescription>
            If an account exists for {email}, a reset link is on its way. The
            link expires in one hour.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-full">
          <Link href={ROUTES.auth.login}>Back to sign in</Link>
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
          autoFocus
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Sending...' : 'Send reset link'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href={ROUTES.auth.login} className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
