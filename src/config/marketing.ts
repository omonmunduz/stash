/**
 * MARKETING SITE CONFIGURATION
 *
 * Central config for marketing pages (home, product, pricing, contact, etc.)
 *
 * TODO markers indicate values that need to be filled in before launch.
 */

export const MARKETING_CONFIG = {
  // Product
  productName: 'Stash', // TODO: Confirm final product name
  tagline: {
    en: 'Business management for service providers',
    ru: 'Управление бизнесом для сферы услуг',
  },

  // Contact
  contact: {
    email: 'support@stashcrm.com', // TODO: Update with real support email
    telegram: '@stashcrm', // TODO: Set real Telegram handle
    whatsapp: '+1234567890', // TODO: Set real WhatsApp number
  },

  // Social links
  social: {
    telegram: 'https://t.me/stashcrm', // TODO: Set real links
    instagram: null, // TODO: Add if exists
    facebook: null, // TODO: Add if exists
  },

  // Pricing
  pricing: {
    currency: 'KGS', // KGS for Kyrgyz Som
    plans: [
      {
        id: 'free',
        name: { en: 'Free', ru: 'Бесплатный' },
        price: 0,
        interval: { en: 'forever', ru: 'навсегда' },
        features: [
          { en: 'Up to 50 customers', ru: 'До 50 клиентов' },
          { en: 'Unlimited services', ru: 'Неограниченные услуги' },
          { en: 'Public booking page', ru: 'Публичная страница записи' },
          { en: '1 employee', ru: '1 сотрудник' },
        ],
      },
      {
        id: 'pro',
        name: { en: 'Pro', ru: 'Профессиональный' },
        price: 1000, // 1000 KGS per month
        interval: { en: 'per month', ru: 'в месяц' },
        popular: true,
        features: [
          { en: 'Unlimited customers', ru: 'Неограниченное количество клиентов' },
          { en: 'Unlimited services & products', ru: 'Неограниченные услуги и товары' },
          { en: 'Public booking page', ru: 'Публичная страница записи' },
          { en: 'Unlimited employees', ru: 'Неограниченное количество сотрудников' },
          { en: 'Inventory management', ru: 'Управление складом' },
          { en: 'Expense tracking', ru: 'Учет расходов' },
          { en: 'Reports', ru: 'Отчеты' },
          { en: 'Priority support', ru: 'Приоритетная поддержка' },
        ],
      },
    ],
  },

  // Demo
  demoBusinessSlug: 'demo-salon', // TODO: Set real demo business slug if available

  // SEO
  seo: {
    defaultTitle: {
      en: 'Stash - Business management for service providers',
      ru: 'Stash - Управление бизнесом для сферы услуг',
    },
    defaultDescription: {
      en: 'CRM for salons, barbershops, clinics and small shops. Manage customers, bookings, inventory and payments in one system.',
      ru: 'CRM для салонов, барбершопов, клиник и небольших магазинов. Управляйте клиентами, записями, складом и платежами в одной системе.',
    },
  },
} as const;

// Currency symbols
export const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '₽',
  KGS: 'с',
  KZT: '₸',
  UZS: 'сўм',
  USD: '$',
};

// Currency names for display
export const CURRENCY_NAMES: Record<string, { en: string; ru: string }> = {
  RUB: { en: 'Russian Ruble', ru: 'Российский рубль' },
  KGS: { en: 'Kyrgyz Som', ru: 'Киргизский сом' },
  KZT: { en: 'Kazakh Tenge', ru: 'Казахстанский тенге' },
  UZS: { en: 'Uzbek Som', ru: 'Узбекский сум' },
  USD: { en: 'US Dollar', ru: 'Доллар США' },
};
