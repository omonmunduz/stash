/**
 * SUPER ADMIN LAYOUT
 *
 * Separate layout for super admin area.
 * Enforces super_admin role on all child routes.
 */

import { redirect } from 'next/navigation';
import { requireSuperAdmin } from '@/features/auth/guards';
import { AppHeader } from '@/components/layout/AppHeader';

export const metadata = {
  title: 'Admin Dashboard',
  description: 'Platform administration',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforce super_admin role
  const user = await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />
      <main className="container mx-auto py-6">
        <div className="mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold text-destructive">
            🔒 Super Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Platform administration - Full access to all organizations
          </p>
        </div>
        {children}
      </main>
    </div>
  );
}
