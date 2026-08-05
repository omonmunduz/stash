/**
 * Layout for the authenticated app.
 *
 * One job: guard. requireActiveUser() is the authoritative check — it queries
 * the database rather than trusting JWT claims. Middleware already redirected
 * based on claims, but claims lag reality (a freshly-onboarded user has no
 * organization_id yet; a deactivated user still carries a valid cookie), and
 * middleware cannot be trusted as a security boundary on its own. Every page in
 * this group is protected by this one call.
 *
 * The resolved user is passed to the shell components as a prop. There is no
 * client-side auth context: nothing consumed it, and shipping one pulled the
 * Supabase browser client (~67 kB gzip, Realtime included) into every dashboard
 * route. Client components that need the session receive it from here.
 *
 * Layouts do not re-render on client-side navigation between pages in the same
 * group, so this guard runs once per full load rather than per navigation. That
 * is why pages performing sensitive reads should still scope queries by
 * organizationId (RLS enforces it too) instead of assuming the layout vouched
 * for them moments ago.
 */

import { requireActiveUser } from '@/features/auth/guards';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';
import { AppHeader } from '@/components/layout/AppHeader';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireActiveUser();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar user={user} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader user={user} />

        {/*
          pb-20 on mobile clears the fixed bottom bar — without it the last
          row of any list sits underneath the tabs and cannot be tapped.
          min-w-0 on the flex child stops a wide table from pushing the
          sidebar off-screen instead of scrolling within its own container.
        */}
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}
