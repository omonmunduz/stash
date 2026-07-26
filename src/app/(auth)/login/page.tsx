/**
 * Login page.
 *
 * Public route — unauthenticated users see the form.
 * Authenticated users are redirected by middleware to /dashboard.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoginForm } from '@/features/auth/components/LoginForm';

export const metadata = {
  title: 'Sign in',
  description: 'Sign in to your account',
};

/**
 * `reason` is set by the /auth/logout route handler so a user who was signed
 * out involuntarily is told why, instead of silently landing back here.
 */
const SIGN_OUT_REASONS: Record<string, string> = {
  deactivated:
    'Your account has been deactivated. Contact your organization owner to regain access.',
  expired: 'Your session expired. Please sign in again.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; next?: string }>;
}) {
  const { reason } = await searchParams;
  const notice = reason ? SIGN_OUT_REASONS[reason] : undefined;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
        <CardDescription>
          Enter your email and password to access your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice && (
          <Alert variant="destructive">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        <LoginForm />
      </CardContent>
    </Card>
  );
}
