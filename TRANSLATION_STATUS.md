# Remaining Translation Work

## Current Status
- **Navigation:** ✅ 100% Translated
- **Auth pages:** ✅ 100% Translated (Login, Signup, Org Setup)
- **Forms:** ✅ 40% Translated (Customer, Product forms done)
- **Dashboard:** ❌ 0% Translated
- **Lists:** ❌ 0% Translated

## Why Only Navigation Shows Russian

The translation infrastructure works perfectly, but we've only integrated translations into a few components so far:

### What's Integrated ✅
1. Navigation menus (Sidebar, AppHeader, BottomNav)
2. LoginForm component
3. SignupForm component
4. OrganizationSetupForm component
5. CustomerForm component
6. ProductForm component

### What's NOT Integrated Yet ❌
1. **Dashboard page** - metrics cards, welcome message, buttons
2. **MetricCard component** - labels like "Owed to you", "Total sales"
3. **TopDebtors component** - "Top debtors" title
4. **SetupChecklist component** - onboarding checklist
5. **All list pages** - Customer list, Product list, Sales list, etc.
6. **All detail pages** - Customer details, Product details, Sale details
7. **SaleForm** - The biggest form (~50 strings)
8. **Other forms** - Services, Employees, Expenses, Appointments, etc.

## The Problem

When you see the dashboard in English, it's because those specific components still have hardcoded strings like:
```tsx
<h1>Welcome back, {name}</h1>  // Hardcoded
<MetricCard label="Owed to you" />  // Hardcoded
<Button>Record sale</Button>  // Hardcoded
```

They need to be changed to:
```tsx
const t = useTranslations('dashboard');
<h1>{t('welcomeBack', { name })}</h1>
<MetricCard label={t('owedToYou')} />
<Button>{t('recordSale')}</Button>
```

## Estimated Work Remaining

To translate the entire dashboard and all pages:
- **Dashboard page:** ~2 hours
- **All list components:** ~3 hours  
- **SaleForm:** ~2 hours
- **Other forms:** ~4 hours
- **Detail pages:** ~2 hours
- **Misc components:** ~2 hours

**Total:** ~15-20 hours of systematic work

## Next Steps

You have two options:

### Option A: I continue translating systematically
I can continue component by component, but this will take many more messages and iterations. I recommend focusing on high-impact pages first:
1. Dashboard page (what users see most)
2. Sales form (most complex, most used)
3. Customer/Product lists
4. Detail pages

### Option B: You do it yourself with the pattern
The pattern is proven and simple. For any component:
1. Add `const t = useTranslations('feature');` at the top
2. Replace `"Hardcoded text"` with `{t('key')}`
3. Add the translation to `messages/en/feature.json` and `messages/ru/feature.json`

The infrastructure is 100% solid. It's now just repetitive work applying the same pattern to ~30 more components.

## Quick Win

If you want to see the dashboard in Russian quickly, I can translate just the dashboard page right now (will take 3-4 messages). But the other 20+ pages will still be in English until we translate them too.