# Public Landing Page i18n - Discovery Report

## Step 0 — Current Architecture Discovery

### 1. Dashboard i18n Mechanism (EXISTING)

**Library:** `next-intl` (installed and configured)

**Locale Resolution** (`src/i18n/request.ts`):
1. Cookie (`NEXT_LOCALE`) - immediate override
2. Authenticated user's `user_profiles.locale` - personal preference
3. Falls back to `'en'`

**Storage:**
- `user_profiles.locale` column - TEXT, check constraint `('en', 'ru')`, default `'en'`
- `organizations.default_locale` column - TEXT, check constraint `('en', 'ru')`, default `'en'` ✅ **ALREADY EXISTS**

**Actions:**
- `setUserLocale(locale)` - saves to `user_profiles.locale` + cookie
- `setOrganizationLocale(locale)` - owner-only, saves to `organizations.default_locale` + revalidates

**Translation files:**
```
messages/
  en/
    common.json, dashboard.json, landing.json, auth.json
    customers.json, products.json, sales.json, inventory.json
    payments.json, expenses.json, services.json, employees.json
    appointments.json, reports.json, settings.json
  ru/ (same structure)
```

**Usage pattern:**
```tsx
// Client components
import { useTranslations } from 'next-intl';
const t = useTranslations('namespace');

// Server components
import { getTranslations } from 'next-intl/server';
const t = await getTranslations('namespace');
```

**Root layout:** Sets `<html lang={locale}>` dynamically via `getLocale()`.

### 2. Organizations Table Schema

**Current columns:**
- `id`, `name`, `slug`, `description`, `logo_url`, `hero_image_url`
- `default_locale` TEXT DEFAULT 'en' CHECK (default_locale IN ('en', 'ru')) ✅ **ALREADY EXISTS**
- `created_at`, `updated_at`, `deleted_at`

**Migration:** `20260918000001_add_locale_columns.sql` added both `user_profiles.locale` and `organizations.default_locale`.

### 3. Public Page Data Access (CRITICAL ISSUE)

**Current implementation:** Public landing page (`src/app/[org-slug]/page.tsx`) uses:
```tsx
const supabase = await createClient(); // Uses NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**RLS Policies (`20260726000003_row_level_security.sql`):**
```sql
-- ALL policies are scoped TO authenticated only!
CREATE POLICY "org_select_own"
ON organizations FOR SELECT TO authenticated
USING (id = public.current_organization_id());

CREATE POLICY "services_select_same_org"
ON services FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

CREATE POLICY "products_select_same_org"
ON products FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());
```

**🚨 CRITICAL FINDING:** There are NO anon policies for public access. The public landing pages are currently BROKEN or not deployed yet. The query:
```tsx
await supabase.from('organizations').select('...').eq('slug', slug)
```
will fail with RLS violations for anonymous users.

**What needs to be added:**
- Anon SELECT policies for `organizations` (by slug, specific columns only)
- Anon SELECT policies for `services` (where `visible_on_landing_page = true`)
- Anon SELECT policies for `products` (where `visible_on_landing_page = true`)
- Anon SELECT policies for `employees` (for booking page)

### 4. Public Routes Structure

**Landing page:** `src/app/[org-slug]/page.tsx`
- Fetches: org (name, slug, description, logo_url, hero_image_url)
- Fetches: services (where is_active AND visible_on_landing_page)
- Fetches: products (where is_active AND visible_on_landing_page)
- Components: BusinessHeader, BusinessHero, ServicesSection, ProductsSection, BookingCTA, BusinessFooter

**Booking page:** `src/app/[org-slug]/book/page.tsx`
- Fetches: org (id, name, slug)
- Fetches: services (where is_active)
- Fetches: employees (where is_active)
- Component: `BookingFlow` (from `src/features/appointments/components/BookingFlow.tsx`)

**All components are CLIENT components** with hardcoded English strings.

### 5. ISR/Caching

**Current:** Uses default Next.js behavior (no explicit `export const revalidate` or `generateStaticParams`).
- Landing pages are dynamically rendered per request
- No static generation or ISR configured
- `revalidatePath('/', 'layout')` is called after locale changes

**Impact:** Language changes will be immediate (no stale cache issues).

### 6. Root Layout `<html lang>`

**Current:** Root layout (`src/app/layout.tsx`) sets:
```tsx
const locale = await getLocale();
return <html lang={locale}>
```

**Problem:** `getLocale()` reads from cookie → user profile → fallback. For public pages, this will always be the visitor's cookie or 'en', NOT the business's language.

**Solution needed:** Public route group needs its own layout that reads locale from the organization record.

### 7. Customer-Facing Notifications

**Search results:** No email/SMS sending code found.
- No `nodemailer`, `sendgrid`, `resend`, `transporter` references in TypeScript files
- Booking confirmations, reminders, notifications are NOT implemented yet

**Deliverable:** No email/SMS localization needed in this task.

---

## Summary for Implementation

### What exists and can be reused:
✅ `organizations.default_locale` column (already in DB)
✅ `next-intl` infrastructure (configured and working)
✅ Translation dictionaries (`messages/en/`, `messages/ru/`)
✅ `setOrganizationLocale()` action (owner-only, with revalidation)
✅ Server/client translation patterns (`useTranslations`, `getTranslations`)

### What is MISSING and must be added:
❌ Anon RLS policies for public reads (organizations, services, products, employees)
❌ Public route locale resolution (must read from org record, not user cookie)
❌ Public route layout with correct `<html lang>`
❌ Translation of all public page components (nav, buttons, headings, forms)
❌ Translation keys for public pages in dictionaries
❌ Locale-aware date/time/number formatting on public pages

### Critical architectural decision:
**The public page MUST read the org's `default_locale` from the database and use it for SSR.**
- Visitor cookie should NOT override the business language (unlike dashboard)
- The business owner sets their language via dashboard switcher → `setOrganizationLocale()` persists it
- Non-owner staff switching language affects only their own dashboard, NOT the public page

### Next steps:
1. Add anon RLS policies (migration)
2. Create public route group with locale-resolving layout
3. Translate all public components
4. Add public translation keys
5. Sync dashboard switcher to also update org locale (if user is owner)
6. Test with anon client
