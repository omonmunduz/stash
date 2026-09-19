# Translation Files - Complete Reference

## 📁 File Structure

```
messages/
├── en/
│   ├── common.json          ✅ Navigation, actions, validation
│   ├── dashboard.json       ✅ Dashboard metrics and stats
│   ├── landing.json         ✅ Public landing pages
│   ├── auth.json            ✅ Login, signup, password reset
│   ├── customers.json       ✅ Customer management
│   ├── products.json        ✅ Product catalog
│   ├── sales.json           ✅ Sales/invoices
│   ├── inventory.json       ✅ Stock management
│   ├── payments.json        ✅ Payment recording
│   ├── expenses.json        ✅ Expense tracking
│   ├── services.json        ✅ Service management
│   ├── employees.json       ✅ Employee/team management
│   ├── appointments.json    ✅ Booking/scheduling
│   ├── reports.json         ✅ Business reports
│   └── settings.json        ✅ App settings
└── ru/
    ├── common.json          ✅ All common strings translated
    ├── dashboard.json       ✅ With proper Russian plurals
    ├── landing.json         ✅ All public page strings
    ├── auth.json            ✅ Complete auth flow
    ├── customers.json       ✅ Complete customer management
    ├── products.json        ✅ Complete product catalog
    ├── sales.json           ✅ Complete sales flow
    ├── inventory.json       ✅ Complete stock management
    ├── payments.json        ✅ Complete payment flow
    ├── expenses.json        ✅ Complete expense tracking
    ├── services.json        ✅ Complete service management
    ├── employees.json       ✅ Complete employee management
    ├── appointments.json    ✅ Complete booking flow
    ├── reports.json         ✅ Complete reports with plurals
    └── settings.json        ✅ Complete settings pages
```

## 🎯 Coverage

### ✅ Fully Translated
- **Authentication** - Login, signup, password reset, organization setup
- **Dashboard** - Metrics, stats, setup checklist
- **Customers** - Forms, list, details, filters, actions
- **Products** - Forms, list, pricing, stock
- **Sales** - Full sales form with credit warnings
- **Inventory** - Stock adjustments, history, filters
- **Payments** - Payment recording and methods
- **Expenses** - Expense tracking and categories
- **Services** - Service management for bookings
- **Employees** - Team management and roles
- **Appointments** - Booking flow and calendar
- **Reports** - Sales, profit, inventory, customer reports
- **Settings** - Organization, profile, team, billing, notifications
- **Landing Pages** - Hero, services, products, booking sections
- **Common** - Navigation, actions, validation, general UI

## 📝 Translation Features

### Russian Language Features
- **Proper plural forms** using ICU message format
  ```json
  "sales": "{count, plural, =0 {Нет продаж} =1 {1 продажа} few {# продажи} other {# продаж}}"
  ```
- **Contextual translations** - Different words for different contexts
- **Professional business terminology** - Appropriate for wholesale business
- **Formal/polite tone** - Standard for business applications

### Message Structure
- **Organized by feature** - Each feature has its own file
- **Nested objects** - Logical grouping (form, list, actions, etc.)
- **Consistent naming** - camelCase keys throughout
- **Reusable strings** - Common strings in common.json

## 🔧 How to Use in Components

### Server Components
```tsx
import { getTranslations } from 'next-intl/server';

async function MyPage() {
  const t = await getTranslations('customers');
  
  return <h1>{t('title')}</h1>;
}
```

### Client Components
```tsx
'use client';
import { useTranslations } from 'next-intl';

function MyComponent() {
  const t = useTranslations('customers.form');
  
  return <label>{t('name')}</label>;
}
```

### With Parameters
```tsx
const t = useTranslations('sales.form');

// Simple interpolation
<p>{t('willOwe', { amount: formatMoney(500) })}</p>

// Plurals
<p>{t('numberOfSales', { count: 5 })}</p>
```

### Nested Keys
```tsx
const t = useTranslations('customers');

// Access nested keys with dot notation
<button>{t('form.saveChanges')}</button>
<p>{t('details.alreadyOwes')}</p>
```

## 📋 Next Steps

### To Complete Full Translation

1. **Update Component Files** - Replace hardcoded strings with `t()` calls
   
   **Priority order:**
   - Start with auth pages (high visibility)
   - Then customer/product forms (most used)
   - Then sales flow (critical path)
   - Finally reports and settings

2. **Pattern to Follow**
   ```tsx
   // Before
   <label>Customer Name</label>
   
   // After
   const t = useTranslations('customers.form');
   <label>{t('name')}</label>
   ```

3. **Test Each Page**
   - Switch language with the globe icon
   - Verify all text updates
   - Check plural forms with different counts
   - Test form validation messages

4. **Common Patterns**
   
   **Form labels:**
   ```tsx
   const t = useTranslations('products.form');
   <Label>{t('name')} <span aria-hidden="true">*</span></Label>
   ```
   
   **Button states:**
   ```tsx
   <Button disabled={isPending}>
     {isPending ? t('saving') : t('saveChanges')}
   </Button>
   ```
   
   **Empty states:**
   ```tsx
   const t = useTranslations('products');
   return (
     <div>
       <p>{t('noProducts')}</p>
       <p>{t('noProductsDescription')}</p>
     </div>
   );
   ```

## 🎨 Translation Best Practices

### DO:
- ✅ Use specific translation keys: `customers.form.name`
- ✅ Keep strings in context: group related strings
- ✅ Use ICU format for plurals: `{count, plural, ...}`
- ✅ Test with both languages before committing
- ✅ Keep translations consistent across features

### DON'T:
- ❌ Concatenate translated strings: `t('hello') + ' ' + name`
- ❌ Put HTML in translation files
- ❌ Translate technical terms unnecessarily
- ❌ Use English keys as fallback in code
- ❌ Forget to add new strings to both en/ and ru/

## 🔍 File-by-File Breakdown

### auth.json
- Login/signup forms
- Password reset flow
- Organization setup
- All error messages

### customers.json
- Customer form (create/edit)
- Customer list and filters
- Customer details page
- Credit limit warnings
- Balance information

### products.json
- Product form (create/edit)
- Product list
- Pricing section
- Stock section
- Image upload

### sales.json
- Complete sales form
- Customer selection
- Product line items
- Payment information
- Credit warnings
- Sale details page
- Payment recording

### inventory.json
- Stock adjustment form
- Adjustment types
- Stock history
- Inventory list
- Filters and summary

### payments.json
- Payment recording form
- Payment methods
- Payment list
- Filters

### expenses.json
- Expense form
- Expense categories
- Vendor information
- Expense list
- Summary reports

### services.json
- Service form (create/edit)
- Service list
- Duration and pricing
- Active/inactive status

### employees.json
- Employee form
- Role descriptions
- Working hours
- Employee list
- Status management

### appointments.json
- Appointment form
- Booking flow (public)
- Calendar views
- Status management
- Appointment actions

### reports.json
- Sales reports
- Profit analysis
- Inventory reports
- Customer reports
- Expense reports
- All with proper plurals

### settings.json
- Organization settings
- Profile settings
- Team management
- Billing/subscription
- Notifications
- Security settings
- Danger zone

## 📊 Statistics

- **Total translation files:** 30 (15 English + 15 Russian)
- **Features covered:** 14
- **Estimated string count:** 500+
- **Build status:** ✅ Passing
- **Infrastructure:** ✅ Complete

## 🚀 Status

**Translation Infrastructure:** 100% Complete ✅
- Database schema updated
- next-intl configured
- Language switcher implemented
- All message files created
- Build passing

**Component Integration:** Not started ⏳
- Components still use hardcoded English strings
- Need to replace strings with `useTranslations()` calls
- Requires systematic page-by-page updates

**Estimated Work:** 8-12 hours to update all components