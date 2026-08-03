/**
 * Application route constants.
 *
 * Centralizes all route paths so:
 * - Renaming a route only requires changing it here
 * - TypeScript catches invalid route usage
 * - Easy to audit all routes in one place
 *
 * Usage:
 *   import { ROUTES } from '@/lib/constants/routes'
 *   router.push(ROUTES.customers.detail('abc-123'))
 */

export const ROUTES = {
  auth: {
    login: '/login',
    signup: '/signup',
    /**
     * Route handler, not a page. Sign-out must happen somewhere that can write
     * cookies — Server Components cannot, so a signOut() in a page silently
     * leaves the session cookie in place.
     */
    logout: '/auth/logout',
    /** Where Supabase sends the user after clicking an email link. */
    callback: '/auth/callback',
    /** Request a reset email. */
    resetPassword: '/auth/reset-password',
    /** Set a new password, reached from the reset email via the callback. */
    updatePassword: '/auth/update-password',
  },

  onboarding: {
    setup: '/onboarding/setup',
    preferences: '/onboarding/preferences',
    product: '/onboarding/product',
    customer: '/onboarding/customer',
    sale: '/onboarding/sale',
    complete: '/onboarding/complete',
  },

  dashboard: {
    home: '/dashboard',
  },

  customers: {
    list: '/customers',
    new: '/customers/new',
    detail: (id: string) => `/customers/${id}`,
    edit: (id: string) => `/customers/${id}/edit`,
  },

  products: {
    list: '/products',
    new: '/products/new',
    detail: (id: string) => `/products/${id}`,
    edit: (id: string) => `/products/${id}/edit`,
  },

  inventory: {
    list: '/inventory',

    /**
     * Stock is counted for two kinds of thing — sellable products and
     * non-sellable items (bags, packaging) — so the kind is part of the path.
     * The previous signature took a bare productId, which left no way to reach
     * an item's stock at all.
     */
    adjust: (kind: 'product' | 'item', id: string) =>
      `/inventory/adjust/${kind}/${id}`,

    /**
     * The non-sellable item catalogue. Products have their own screens under
     * /products; these are the things that get counted but never sold.
     */
    items: {
      list: '/inventory/items',
      new: '/inventory/items/new',
      edit: (id: string) => `/inventory/items/${id}/edit`,
    },
  },

  sales: {
    list: '/sales',
    new: '/sales/new',
    detail: (id: string) => `/sales/${id}`,
    edit: (id: string) => `/sales/${id}/edit`,
  },

  payments: {
    list: '/payments',

    /**
     * Optionally preselects who paid, matching sales.new.
     *
     * Previously took a saleId, which had no screen behind it: a payment against
     * one specific invoice is recorded from that invoice, where the amount owed
     * is already on the page. Arriving at a blank form knowing only the sale
     * would mean looking the customer up again.
     */
    new: (customerId?: string) =>
      customerId ? `/payments/new?customer=${customerId}` : '/payments/new',
  },

  expenses: {
    list: '/expenses',
    new: '/expenses/new',
    detail: (id: string) => `/expenses/${id}`,
  },

  reports: {
    overview: '/reports',
    sales: '/reports/sales',
    customers: '/reports/customers',
    inventory: '/reports/inventory',
    expenses: '/reports/expenses',
    profit: '/reports/profit',
  },

  settings: {
    general: '/settings',
    users: '/settings/users',
    billing: '/settings/billing',
  },

  api: {
    customers: '/api/customers',
    products: '/api/products',
    sales: '/api/sales',
    webhooks: {
      stripe: '/api/webhooks/stripe',
    },
  },
} as const;
