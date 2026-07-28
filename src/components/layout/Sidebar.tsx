/**
 * DESKTOP SIDEBAR
 *
 * Hidden below `lg`, where the bottom bar takes over.
 *
 * Disabled items render as spans, not links. A disabled anchor is still
 * focusable and still navigates on Enter, so the only way to genuinely block a
 * route that does not exist yet is to not emit an anchor at all.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { NAV_ITEMS, isNavItemActive } from '@/lib/constants/navigation';
import { hasRole } from '@/features/auth/roles';
import { ROUTES } from '@/lib/constants/routes';
import type { AuthUser } from '@/features/auth/types';
import { cn } from '@/lib/utils/cn';

export function Sidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname();

  const items = NAV_ITEMS.filter(
    (item) => !item.minimumRole || hasRole(user, item.minimumRole)
  );

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card lg:block">
      {/* sticky + h-screen so the nav stays put while long lists scroll. */}
      <div className="sticky top-0 flex h-screen flex-col gap-1 overflow-y-auto p-3">
        <div className="px-3 py-4">
          <p className="truncate text-sm font-semibold">{user.organization.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>

        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(item.href, pathname);

            if (!item.available) {
              return (
                <span
                  key={item.href}
                  title={item.hint}
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    Soon
                  </span>
                </span>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent'
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* POST, not a link: sign-out writes cookies, and a GET could be fired
            by Next's link prefetching on hover. */}
        <form action={ROUTES.auth.logout} method="post" className="border-t border-border pt-2">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
