/**
 * MOBILE BOTTOM NAVIGATION
 *
 * Visible below `lg` only. Chosen over a hamburger menu because the primary user
 * is one-handed on a phone: a drawer costs an extra tap on every single
 * navigation, and the thumb reaches the bottom of the screen far more easily
 * than the top-left corner.
 *
 * pb-[env(safe-area-inset-bottom)] keeps the tabs clear of the iPhone home
 * indicator, which otherwise overlaps the last few pixels of the bar.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRIMARY_NAV_ITEMS, isNavItemActive } from '@/lib/constants/navigation';
import { cn } from '@/lib/utils/cn';

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(item.href, pathname);

          return (
            <li key={item.href} className="flex-1">
              {item.available ? (
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    // min-h-14 keeps every tab a comfortable tap target.
                    'flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <Icon
                    className={cn('size-5', active && 'stroke-[2.5]')}
                    aria-hidden="true"
                  />
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  title={item.hint}
                  className="flex min-h-14 cursor-not-allowed flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] text-muted-foreground/50"
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
