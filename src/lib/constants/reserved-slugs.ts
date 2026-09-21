/**
 * RESERVED SLUGS
 *
 * Top-level routes that cannot be used as business slugs.
 * These are enforced during signup, onboarding, and business settings
 * to prevent collisions with marketing pages, dashboard routes, and system paths.
 */

export const RESERVED_SLUGS = [
  // Marketing pages
  'product',
  'pricing',
  'faq',
  'contact',
  'privacy',
  'terms',
  'about',

  // Auth & onboarding
  'login',
  'signup',
  'auth',
  'onboarding',

  // Dashboard
  'dashboard',

  // Feature routes (existing in codebase)
  'customers',
  'products',
  'sales',
  'services',
  'employees',
  'appointments',
  'inventory',
  'payments',
  'expenses',
  'reports',
  'settings',

  // API & actions
  'api',
  'actions',

  // System & framework
  '_next',
  'static',
  'assets',
  'favicon',
  'robots',
  'sitemap',
  'app',
  'www',
  'admin',

  // Future reserved
  'blog',
  'help',
  'docs',
  'support',
  'partners',
  'book', // Booking entry point
] as const;

export type ReservedSlug = typeof RESERVED_SLUGS[number];

/**
 * Check if a slug is reserved.
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase() as ReservedSlug);
}

/**
 * Get a localized error message for reserved slug.
 */
export function getReservedSlugError(locale: 'en' | 'ru'): string {
  return locale === 'ru'
    ? 'Это имя зарезервировано системой. Пожалуйста, выберите другое.'
    : 'This name is reserved by the system. Please choose another.';
}
