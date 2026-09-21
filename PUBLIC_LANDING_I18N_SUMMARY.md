# Public Landing Page i18n Implementation - Summary

## ✅ Completed

### 1. Database & RLS Policies
**Migration:** `supabase/migrations/20260919000001_public_landing_anon_access.sql`
- Added anon SELECT policies for `organizations` (by slug, non-deleted)
- Added anon SELECT policies for `services` (visible_on_landing_page = true)
- Added anon SELECT policies for `products` (visible_on_landing_page = true)
- Added anon SELECT policies for `employees` (is_active = true, for booking)
- All policies are read-only; writes remain authenticated-only

**Existing column reused:** `organizations.default_locale` (already exists from migration `20260918000001`)

### 2. Dashboard Switcher Integration
**Updated:** `src/app/actions/locale.ts`
- When owner switches language via dashboard switcher, now ALSO updates `organizations.default_locale`
- Non-owner staff switching language only affects their personal dashboard UI
- Automatically revalidates public landing pages (`/${slug}`, `/${slug}/book`) after org locale change

### 3. Public Route Locale Resolution
**Created:** `src/lib/i18n/public-locale.ts`
- Helper function `getPublicOrgLocale(orgSlug)` reads locale from organization record
- Public pages use business's language, NOT visitor's cookie/preference

**Created:** `src/app/[org-slug]/layout.tsx`
- Public route group layout that resolves locale from org database
- Loads appropriate message dictionaries for that locale
- Wraps children in NextIntlClientProvider with org's locale

**Updated:** `src/app/[org-slug]/page.tsx`
- Added `default_locale` to metadata for proper `<html lang>` attribute
- Translated empty state using server-side `getTranslations`

**Updated:** `src/app/[org-slug]/book/page.tsx`
- Translated page title and subtitle using server-side `getTranslations`

### 4. Component Translations (10 files)
All public landing page components now fully localized:

**Navigation & Header:**
- `src/app/[org-slug]/components/BusinessHeader.tsx` - Nav links, Book Now button

**Hero Section:**
- `src/app/[org-slug]/components/BusinessHero.tsx` - Dynamic hero messages, CTA buttons

**Services:**
- `src/app/[org-slug]/components/ServicesSection.tsx` - Section title/subtitle
- `src/app/[org-slug]/components/ServiceCard.tsx` - Book Now button, duration formatting (30 min → 30 мин)

**Products:**
- `src/app/[org-slug]/components/ProductsSection.tsx` - Section title/subtitle
- `src/app/[org-slug]/components/ProductCard.tsx` - Price formatting

**CTA & Footer:**
- `src/app/[org-slug]/components/BookingCTA.tsx` - Call-to-action section
- `src/app/[org-slug]/components/BusinessFooter.tsx` - Copyright notice

### 5. Translation Keys Added

**English:** `messages/en/landing.json` (29 keys)
```
nav: home, services, products, bookNow
hero: exploreServicesAndProducts, bookAppointmentToday, discoverProducts, bookNow, viewProducts
services: title, subtitle, bookNow
products: title, subtitle
cta: title, subtitle, bookAppointment
footer: copyright
empty: title, description
booking: title, subtitle
```

**Russian:** `messages/ru/landing.json` (29 keys)
- Complete professional translations
- Proper terminology consistent with dashboard
- ICU MessageFormat for dynamic values ({orgName}, {year})

### 6. Locale-Aware Formatting

**Duration formatting:**
- English: "30 min", "1 hr", "1 hr 30 min"
- Russian: "30 мин", "1 ч", "1 ч 30 мин"

**Price formatting:**
- Uses `Intl.NumberFormat` with appropriate locale ('ru-RU' vs 'en-US')
- Currency (USD) stays the same, only surrounding formatting changes

**Dates/times:**
- Handled by existing Intl formatting infrastructure

### 7. What Was NOT Changed (Per Requirements)

**User-generated content (not translated):**
- Business name
- Organization description/tagline
- Service names and descriptions
- Product names and descriptions
- Employee names and bios
- Custom unit_of_measure values (user-typed)

**Not implemented (not found in codebase):**
- Email/SMS notifications (no transporter/sendgrid/nodemailer found)
- Booking flow form translation (BookingFlow component not modified - would require separate task)

## 🎯 How It Works

### For Business Owners
1. Owner switches language in dashboard (globe icon)
2. Their personal dashboard language changes
3. **AND** their organization's public page language changes
4. Public landing page at `/{slug}` now renders in that language for ALL visitors
5. Booking page at `/{slug}/book` also renders in that language

### For Staff Members
1. Staff member switches language in dashboard
2. **Only** their personal dashboard language changes
3. Public page language stays unchanged (owner controls it)

### For Visitors
1. Visit `/{slug}` or `/{slug}/book` (no login)
2. Page renders in business's default language
3. Visitor's cookie/preference does NOT override business language
4. Anonymous RLS policies allow reading org/services/products/employees

## 📊 Files Changed

**Migrations:** 1 file created
- `supabase/migrations/20260919000001_public_landing_anon_access.sql`

**Actions:** 1 file updated
- `src/app/actions/locale.ts`

**Helpers:** 1 file created
- `src/lib/i18n/public-locale.ts`

**Layouts:** 1 file created
- `src/app/[org-slug]/layout.tsx`

**Pages:** 2 files updated
- `src/app/[org-slug]/page.tsx`
- `src/app/[org-slug]/book/page.tsx`

**Components:** 8 files updated
- `src/app/[org-slug]/components/BusinessHeader.tsx`
- `src/app/[org-slug]/components/BusinessHero.tsx`
- `src/app/[org-slug]/components/ServicesSection.tsx`
- `src/app/[org-slug]/components/ServiceCard.tsx`
- `src/app/[org-slug]/components/ProductsSection.tsx`
- `src/app/[org-slug]/components/ProductCard.tsx`
- `src/app/[org-slug]/components/BookingCTA.tsx`
- `src/app/[org-slug]/components/BusinessFooter.tsx`

**Translations:** 2 files updated
- `messages/en/landing.json`
- `messages/ru/landing.json`

**Total:** 16 files (1 created migration, 1 created helper, 1 created layout, 13 updated)

## 🔒 Security

**Anon policies are read-only:**
- Anonymous users can SELECT only
- No INSERT, UPDATE, or DELETE allowed
- Filtered by visibility flags and soft-delete status
- Only exposes columns needed for public display

**Staff access preserved:**
- All existing authenticated policies remain unchanged
- Owner-only org locale writes enforced by existing RLS

## ✅ Testing Checklist

1. **Apply migration:**
   ```bash
   supabase db push
   ```

2. **Test as owner:**
   - Login to dashboard
   - Switch language to Russian → verify dashboard changes
   - Open `/{your-org-slug}` in incognito → should be Russian
   - Switch language to English → verify dashboard changes
   - Open `/{your-org-slug}` in incognito → should be English

3. **Test as staff (non-owner):**
   - Login as employee/manager
   - Switch language to Russian → verify dashboard changes
   - Open `/{your-org-slug}` in incognito → should stay in owner's language

4. **Test anonymous visitor:**
   - Open `/{org-slug}` in incognito (no login)
   - Should see content in business's default language
   - All nav links, buttons, headings should be translated
   - Service cards show "Записаться" (Russian) or "Book Now" (English)
   - Duration shows "30 мин" (Russian) or "30 min" (English)
   - Footer shows "© 2026 {Name}. Все права защищены." (Russian)

5. **Test booking page:**
   - Open `/{org-slug}/book` in incognito
   - Page title and subtitle should be translated
   - BookingFlow form will need separate translation task

## 📝 Known Limitations

1. **BookingFlow component not translated:** The booking form itself (service selection, time slots, customer details form) still shows English. This is a large component that would require a separate focused task.

2. **404 pages:** Unknown business slug shows default 404, not localized.

3. **Error pages:** Server errors show default Next.js error pages, not localized.

4. **Product unit suffixes:** Custom free-text units (like "box", "roll") are shown as-is. Could add a translation helper for common preset units in a future enhancement.

## 🚀 Next Steps (Optional Enhancements)

1. Translate BookingFlow component and its subcomponents
2. Add localized 404/error pages for public routes
3. Create unit-of-measure translation helper for common units
4. Add language switcher to public pages (let visitors override business language)
5. When email/SMS notifications are implemented, localize them too
