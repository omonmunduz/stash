/**
 * Signup page.
 *
 * Public route — allows new users to create an account.
 *
 * After a successful signup the user either lands on /onboarding/setup directly
 * (email confirmation disabled) or sees a confirm-your-email panel in place of
 * the form (confirmation enabled, which is the Supabase default). SignupForm
 * decides which, based on whether signUpAction returned a session.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignupForm } from '@/features/auth/components/SignupForm';

export const metadata = {
  title: 'Sign up',
  description: 'Create a new account',
};

export default function SignupPage() {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>
          Get started with your wholesale business management
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
      </CardContent>
    </Card>
  );
}
