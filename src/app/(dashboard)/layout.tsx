/**
 * Layout for the authenticated app.
 *
 * Two jobs:
 *
 * 1. Guard. requireActiveUser() is the authoritative check — it queries the
 *    database rather than trusting JWT claims. Middleware already redirected
 *    based on claims, but claims lag reality (a freshly-onboarded user has no
 *    organization_id yet; a deactivated user still carries a valid cookie), and
 *    middleware cannot be trusted as a security boundary on its own. Every page
 *    in this group is protected by this one call.
 *
 * 2. Mount AuthProvider with server-resolved state, so client components can
 *    read the session without a fetch-on-mount waterfall.
 *
 * Layouts do not re-render on client-side navigation between pages in the same
 * group, so this guard runs once per full load rather than per navigation. That
 * is why pages performing sensitive reads should still scope queries by
 * organizationId (RLS enforces it too) instead of assuming the layout vouched
 * for them moments ago.
 */

import { requireActiveUser } from '@/features/auth/guards';
import { AuthProvider } from '@/features/auth/components/AuthProvider';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireActiveUser();

  return (
    <AuthProvider initialState={{ status: 'authenticated', user }}>
      <div className="min-h-screen bg-background">{children}</div>
    </AuthProvider>
  );
}
