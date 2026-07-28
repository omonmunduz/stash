/**
 * APP HEADER
 *
 * Mobile-only: on desktop the sidebar already shows the organization name and
 * the account menu, so repeating them in a top bar wastes vertical space.
 *
 * Holds the overflow menu for nav items that did not fit in the bottom bar, and
 * sign-out. Sign-out is a POST form to the /auth/logout route handler rather
 * than a link — clearing the session cookie requires a write, and a GET link can
 * be triggered by a prefetch, which would sign the user out just for hovering.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import { SECONDARY_NAV_ITEMS, isNavItemActive } from '@/lib/constants/navigation';
import { hasRole } from '@/features/auth/roles';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants/routes';
import type { AuthUser } from '@/features/auth/types';
import { cn } from '@/lib/utils/cn';

export function AppHeader({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = SECONDARY_NAV_ITEMS.filter(
    (item) => !item.minimumRole || hasRole(user, item.minimumRole)
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card lg:hidden">
      <div className="flex h-14 items-center justify-between gap-2 px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{user.organization.name}</p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="overflow-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
      </div>

      {menuOpen && (
        <div id="overflow-menu" className="border-t border-border px-2 py-2">
          <nav aria-label="More sections" className="flex flex-col">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(item.href, pathname);

              if (!item.available) {
                return (
                  <span
                    key={item.href}
                    aria-disabled="true"
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground/60"
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
                      Soon
                    </span>
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm',
                    active ? 'bg-accent font-medium' : 'hover:bg-accent'
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-2 border-t border-border pt-2">
            <p className="px-3 pb-2 text-xs text-muted-foreground">{user.email}</p>
            <form action={ROUTES.auth.logout} method="post">
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent"
              >
                <LogOut className="size-4 shrink-0" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
