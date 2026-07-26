/**
 * UPDATE PASSWORD FORM
 *
 * Sets a new password. Reached from the reset email via /auth/callback, which
 * exchanges the recovery code for a session first — so this form relies on that
 * session existing rather than handling a token itself.
 *
 * Design decisions:
 * - Confirmation field is checked client-side. It's a typo guard, not a security
 *   control, so there's no reason to spend a round trip on it.
 * - Strength rules live in the shared Zod schema and are enforced server-side;
 *   the hint here just tells the user the rule up front.
 */

'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { updatePasswordAction } from '@/app/actions/auth';

export function UpdatePasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    startTransition(async () => {
      const result = await updatePasswordAction({ password });

      if (!result.success) {
        setError(result.error);
      }
      // Success redirects to the dashboard from the action.
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
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isPending}
          required
          autoComplete="new-password"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          At least 8 characters, with one letter and one number.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={isPending}
          required
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Saving...' : 'Set new password'}
      </Button>
    </form>
  );
}
