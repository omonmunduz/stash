# Marketing Site Discovery Report

## Step 0 — Discovery Results

### 1. i18n System (Existing)
**Library:** `next-intl` (installed and configured)

**Current setup:**
- Server components: `getTranslations` from `next-intl/server`
- Client components: `useTranslations` from `next-intl`
- Configuration: `src/i18n/request.ts`
- Dictionaries: `messages/en/` and `messages/ru/`
- Locale resolution priority:
  1. Public org pages: read from `organizations.default_locale` via `x-org-slug` header
  2. Dashboard: cookie (`NEXT_LOCALE`) → user profile → fallback 'en'

**Cookie used:** `NEXT_LOCALE`
**Decision:** Marketing site will use a SEPARATE cookie `SITE_LANG` to avoid conflicts with dashboard locale and org public pages.

### 2. Existing Middleware
**File:** `src/middleware.ts`

**Current behavior:**
- Refreshes Supabase session
- Sets `x-org-slug` header for public org routes
- Routes based on auth state:
  - No session → `/login` (except `/signup` and `/auth/*`)
  - Session without org → `/onboarding/setup`
  - Session with org → allowed through
  - Root `/` → redirects to login (no session) or dashboard (session)

**Decision:** Will add geo-based language detection to existing middleware, composed with current logic.

### 3. Existing Auth Routes
**Route groups:**
- `(auth)/login` - Login page
- `(auth)/signup` - Signup page
- `auth/*` - Auth callbacks (never redirected)
- `(onboarding)/setup` - Organization setup

**Logged-in user lands:** `/dashboard` (if has org) or `/onboarding/setup` (if no org)

### 4. Current Root Route
**Status:** `/` has NO page.tsx - middleware redirects:
- Unsigned → `/login`
- Signed in → `/dashboard` or `/onboarding/setup`

**Decision:** Will create marketing home at `/` - middleware needs update to allow anonymous access to marketing routes.

### 5. Route Structure
**Existing:**
```
src/app/
  (auth)/          - Auth pages
  (dashboard)/     - Dashboard pages (protected)
  (onboarding)/    - Onboarding flow
  [org-slug]/      - Public business pages
  auth/            - Auth callbacks
  api/             - API routes
  actions/         - Server actions
```

**Deploy target:** Vercel (confirmed by geo header strategy)

### 6. Verified Product Features (from codebase scan)

**✅ Features that EXIST:**
1. **Products management** - `src/app/(dashboard)/products/` - name, description, price, unit_of_measure, stock, images
2. **Services management** - `src/app/(dashboard)/services/` - name, description, duration_minutes, price, active status
3. **Employees/Staff** - `src/app/(dashboard)/employees/` - display_name, role, slug, photo, bio, working hours
4. **Customer management** - `src/app/(dashboard)/customers/` - name, phone, email, address, balance (tab/credit)
5. **Sales** - `src/app/(dashboard)/sales/` - sale creation, items, payment tracking
6. **Payments** - `src/app/(dashboard)/payments/` - record payments against customer balance
7. **Appointments** - `src/app/(dashboard)/appointments/` - booking system with service/employee/time slots
8. **Inventory** - `src/app/(dashboard)/inventory/` - stock tracking, adjustments, low-stock warnings
9. **Expenses** - `src/app/(dashboard)/expenses/` - expense tracking with categories
10. **Reports** - `src/app/(dashboard)/reports/` - expense reports by period
11. **Public business page** - `src/app/[org-slug]/` - auto-generated page with services, products, booking
12. **User roles** - owner, admin, manager, employee (from RLS policies)

**❌ Features that DON'T exist (will NOT advertise):**
- Integrations (payment gateways, accounting software, social media)
- Mobile app (only web responsive)
- Email/SMS notifications (no transporter found)
- Multi-location support
- Gift cards
- Loyalty programs

### 7. Existing Styles & Theme
**File:** `src/app/globals.css`
- Uses Tailwind CSS
- CSS variables for theming (light/dark mode via `prefers-color-scheme`)
- Inter font with Cyrillic subset
- Existing color palette from CSS variables

**Icon library:** `lucide-react` (found in multiple components)

---

## Implementation Plan

### Reserved Slugs
**Will create:** `src/lib/constants/reserved-slugs.ts`

**List:**
```typescript
// Marketing pages
'product', 'pricing', 'faq', 'contact', 'privacy', 'terms', 'about',

// Auth/Dashboard
'login', 'signup', 'dashboard', 'onboarding', 'auth',

// Features (existing routes)
'customers', 'products', 'sales', 'services', 'employees', 
'appointments', 'inventory', 'payments', 'expenses', 'reports', 'settings',

// Framework/system
'api', 'actions', '_next', 'static', 'assets', 'favicon', 'robots', 
'sitemap', 'app', 'www', 'admin',

// Future
'blog', 'help', 'docs', 'support', 'partners'
```

### Route Structure
```
src/app/
  (marketing)/
    page.tsx              # Home
    product/page.tsx      # Product/About
    pricing/page.tsx      # Pricing
    faq/page.tsx          # FAQ
    contact/page.tsx      # Contact
    privacy/page.tsx      # Privacy
    terms/page.tsx        # Terms
    layout.tsx            # Marketing layout (header + footer)
    components/           # Marketing-specific components
```

### Config File
**Will create:** `src/config/marketing.ts`

**TODO markers for:**
- Product name (use "Stash" from existing app)
- Pricing plans (Free/Pro placeholders)
- Contact details (email, Telegram, WhatsApp)
- Social links
- Demo business slug

### Translation Dictionaries
**Will create:**
- `messages/en/marketing.json`
- `messages/ru/marketing.json`

**Namespaces:**
- `marketing.nav` - Header navigation
- `marketing.home` - Home page sections
- `marketing.product` - Product page
- `marketing.pricing` - Pricing page
- `marketing.faq` - FAQ
- `marketing.contact` - Contact
- `marketing.legal` - Privacy/Terms
- `marketing.cta` - Call-to-action buttons

### Middleware Updates
**Will add to** `src/middleware.ts`:
1. Geo-based language detection (before auth checks)
2. Set `SITE_LANG` cookie if not exists
3. Read `x-vercel-ip-country` or `cf-ipcountry`
4. Allow anonymous access to marketing routes
5. Respect `?lang=` query param

### Illustration Slots (Code-based Mockups)
**Will need real screenshots later:**
1. Appointments calendar view (dashboard mockup)
2. Client tab/balance card (customer detail mockup)
3. Services list (dashboard services table)
4. Public booking page (mobile + desktop mockup)
5. Employee schedule view
6. Inventory with low-stock warning
7. Product catalog grid

---

## Assumptions & Decisions

1. **Product name:** Using "Stash" (found in existing app title)
2. **Target audience:** Small service businesses in Russia, Kyrgyzstan, Kazakhstan, Uzbekistan
3. **Russian-first approach:** Russian is primary language, English is translation
4. **No contact form:** No email sending mechanism found - will show contact links only
5. **Currency:** Will support RUB/KGS/KZT/UZS/USD via config
6. **SEO limitation:** Cookie-based language means Russian served to crawlers by default; English not indexed separately (acceptable for MVP)

---

## Next Steps

Ready to implement:
1. Create marketing route group with layout
2. Update middleware for geo-based language
3. Create config file with TODOs
4. Build home page with hero, features, how-it-works
5. Build product, pricing, FAQ, contact, legal pages
6. Add reserved slug validation
7. Create code-based product illustrations

Proceed?
