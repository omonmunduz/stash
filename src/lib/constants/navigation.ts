/**
 * NAVIGATION MAP
 *
 * One definition of the app's navigation, consumed by the desktop sidebar, the
 * mobile bottom bar, and the mobile overflow menu. Adding a section means
 * editing this file and nothing else.
 *
 * `available: false` marks a section whose route does not exist yet. Those
 * render as disabled items rather than being hidden, so the app's shape is
 * visible from day one and nobody taps into a 404. Flip the flag when the
 * feature ships.
 *
 * `primary: true` promotes an item into the mobile bottom bar. Keep it to four
 * — five tabs on a small phone leaves each one too narrow to hit reliably.
 */

import {
  BarChart3,
  Boxes,
  Home,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES } from './routes';
import type { UserRole } from '@/features/users/types';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** False until the feature's routes exist. Renders disabled. */
  available: boolean;
  /** Shown in the mobile bottom bar. Limit to four. */
  primary?: boolean;
  /** Minimum role required to see the item. Omitted means everyone. */
  minimumRole?: UserRole;
  /** Short hint used as the title attribute on disabled items. */
  hint?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Home',
    href: ROUTES.dashboard.home,
    icon: Home,
    available: true,
    primary: true,
  },
  {
    label: 'Customers',
    href: ROUTES.customers.list,
    icon: Users,
    available: true,
    primary: true,
  },
  {
    label: 'Sales',
    href: ROUTES.sales.list,
    icon: ShoppingCart,
    available: true,
    primary: true,
  },
  {
    label: 'Products',
    href: ROUTES.products.list,
    icon: Package,
    available: true,
    primary: true,
  },
  {
    label: 'Inventory',
    href: ROUTES.inventory.list,
    icon: Boxes,
    available: true,
  },
  {
    label: 'Payments',
    href: ROUTES.payments.list,
    icon: Wallet,
    available: true,
  },
  {
    label: 'Expenses',
    href: ROUTES.expenses.list,
    icon: Receipt,
    available: true,
  },
  {
    label: 'Reports',
    href: ROUTES.reports.overview,
    icon: BarChart3,
    available: false,
    minimumRole: 'manager',
    hint: 'Needs sales data to report on',
  },
  {
    label: 'Settings',
    href: ROUTES.settings.general,
    icon: Settings,
    available: false,
    minimumRole: 'admin',
    hint: 'Not built yet',
  },
];

/** Items promoted to the mobile bottom bar. */
export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((item) => item.primary);

/** Everything not in the bottom bar, for the mobile overflow menu. */
export const SECONDARY_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.primary);

/**
 * Whether a nav href should be styled as the current section.
 *
 * Prefix matching so /customers/abc/edit still highlights Customers, with an
 * exact check for the dashboard — otherwise a prefix rule on '/' would light up
 * Home on every page in the app.
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === ROUTES.dashboard.home) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
