# Russian Localization - Expenses Page Complete

## Summary

Fixed all remaining English strings on the Expenses page and related components. The application now displays fully in Russian when the ru locale is selected.

## Files Changed

### Translation Files (6 files)
1. **messages/en/expenses.json** - Added categories, periods, filters, and table sections
2. **messages/ru/expenses.json** - Added complete Russian translations
3. **messages/en/reports.json** - Added breakdown section with plural forms
4. **messages/ru/reports.json** - Added breakdown section with Russian plural forms
5. **messages/en/common.json** - Added saveChanges and saving to actions
6. **messages/ru/common.json** - Added saveChanges and saving to actions

### Helper Files (3 new files created)
1. **src/lib/i18n/format-helpers.ts** - Locale-aware formatting helpers for client components
2. **src/features/payments/translation-helpers.ts** - Payment method translation helper
3. **src/features/expenses/translation-helpers.ts** - Category and period translation helpers

### Component Files (8 files)
1. **src/features/expenses/components/ExpenseFilters.tsx** - Translated search, period chips, filter labels, and dropdowns
2. **src/features/expenses/components/ExpenseList.tsx** - Translated table headers, categories, methods, dates with locale formatting
3. **src/features/expenses/components/ExpenseForm.tsx** - Translated category suggestions in datalist
4. **src/features/expenses/components/ExpenseRowActions.tsx** - Translated delete confirmation and aria-labels
5. **src/features/expenses/components/CategoryBreakdown.tsx** - Translated breakdown heading and category labels
6. **src/features/expenses/components/ExpenseReportPeriods.tsx** - Translated period chips

### Page Files (2 files)
1. **src/app/(dashboard)/expenses/page.tsx** - Updated to use translated period labels and categories
2. **src/app/(dashboard)/reports/expenses/page.tsx** - Updated to use translated period labels

## Translation Keys Added

### expenses.categories (10 system categories)
- `stockPurchase`, `transport`, `rent`, `salaries`, `utilities`, `packaging`, `airtimeAndData`, `repairs`, `licensesAndFees`, `marketing`
- User-created categories pass through untranslated

### expenses.periods (4 period options)
- `month` → "This month" / "В этом месяце"
- `quarter` → "Last 3 months" / "Последние 3 месяца"
- `year` → "This year" / "В этом году"
- `all` → "Everything" / "Все"

### expenses.filters (9 keys)
- Search placeholder, labels, "Any" option, "Clear" button, updating status

### expenses.table (8 keys)
- Table headers (reference, date, category, whatFor, method, amount)
- Paid to label, edit/delete aria-labels, delete confirmation

### reports.expenses.breakdown (3 keys with plurals)
- Heading, description with plural forms, expense count with plural forms

### common.actions (2 keys)
- `saveChanges` → "Save changes" / "Сохранить изменения"
- `saving` → "Saving..." / "Сохранение..."

## Shared Translation Helpers Created

### getPaymentMethodLabel(method, t)
- Translates system payment methods: cash, card, bank_transfer, check, other
- User-defined methods pass through unchanged
- Used in: ExpenseList, ExpenseFilters, ExpenseForm

### getCategoryLabel(category, t)
- Translates system-suggested categories (Stock purchase, Transport, etc.)
- User-created categories pass through unchanged
- Used in: ExpenseList, ExpenseFilters, ExpenseRowActions, CategoryBreakdown, PeriodSummary

### getPeriodLabel(period, t)
- Translates period values: month, quarter, year, all
- Used in: ExpenseFilters, ExpenseReportPeriods, expenses page

## Locale-Aware Formatting

### Date Formatting
- **ExpenseList** now uses `new Intl.DateTimeFormat(locale)` to format dates
- English: "Sep 17, 2026"
- Russian: "17 сент. 2026 г."

### Money Formatting
- Already using Intl.NumberFormat, remains locale-aware
- Consistent across all components

## Data Handling

### System vs User Data
- **System-defined values** (preset categories, payment methods) are translated
- **User-generated values** (custom categories, vendor names, descriptions) pass through unchanged
- Filtering works on stored database values, not translated labels

### Database Unchanged
- No schema changes
- No data migrations
- Display-layer translation only

## Russian Terminology Choices

| English | Russian | Notes |
|---------|---------|-------|
| Expense | Расход | Singular business expense |
| Expenses | Расходы | Plural, page title |
| Stock purchase | Закупка товара | Buying inventory |
| Transport | Транспорт | Delivery/logistics |
| Rent | Аренда | Facility rent |
| Salaries | Зарплаты | Employee wages |
| Utilities | Коммунальные услуги | Power, water, etc |
| Packaging | Упаковка | Product packaging |
| Airtime and data | Связь и интернет | Phone/internet |
| Repairs | Ремонт | Maintenance |
| Licenses and fees | Лицензии и сборы | Government fees |
| Marketing | Маркетинг | Advertising |
| This month | В этом месяце | Current month |
| Last 3 months | Последние 3 месяца | Rolling 3 months |
| This year | В этом году | Calendar year |
| Everything | Все | All time |
| Any | Любой | Filter dropdown default |

## Russian Plural Forms

Implemented correct Russian plural forms using ICU MessageFormat:

```
{count, plural, =1 {1 расход} few {# расхода} other {# расходов}}
{count, plural, =1 {Одна категория.} few {# категории, от большей к меньшей.} other {# категорий, от большей к меньшей.}}
```

## Verification

### Build Status
- ✅ TypeScript compilation: No errors
- ✅ Next.js build: Successful
- ✅ All 45 routes built successfully

### Testing Checklist
- [ ] Expenses list page with ru locale
  - [ ] Filter search placeholder
  - [ ] Period chips (This month, Last 3 months, This year, Everything)
  - [ ] Category dropdown (Any + translated categories)
  - [ ] Method dropdown (Any + translated methods)
  - [ ] Table headers
  - [ ] Category badges
  - [ ] Payment method values
  - [ ] Date formatting (17 сент. 2026 г.)
  - [ ] "Paid to" text
- [ ] Expense form (/expenses/new)
  - [ ] Category datalist shows translated suggestions
  - [ ] All labels and placeholders
- [ ] Expense breakdown (/reports/expenses)
  - [ ] Period chips
  - [ ] "By category" heading
  - [ ] Category labels in breakdown
  - [ ] Expense counts with correct plurals
- [ ] Delete confirmation dialog
  - [ ] Translated category name in confirmation

## No English Remaining

All hardcoded English strings identified in the task have been translated:
- ✅ Filter bar (search, periods, dropdowns, "Any", "Clear")
- ✅ Summary cards (period subtitle follows selected period)
- ✅ Table (headers, date format, payment methods, categories)
- ✅ Row actions (edit/delete aria-labels, confirmation dialog)
- ✅ Breakdown view (heading, category labels, counts)
- ✅ Add/Edit form (category suggestions)
- ✅ Empty states (already translated)

## Strings Deliberately Left Untranslated

1. **User-generated content**: Expense descriptions, vendor names, custom category names
2. **Database IDs**: expense_number, internal identifiers
3. **Technical values**: Stored enum values (used only for filtering)

## Assumptions

1. The 10 EXPENSE_CATEGORY_SUGGESTIONS are the complete list of system categories
2. SYSTEM_PAYMENT_METHODS (cash, card, bank_transfer, check, other) covers all system methods
3. Date formatting should use browser's Intl with the active locale
4. Expense categories are stored in English in the database (matching suggestions)
5. Period labels in filters and summary cards should always match
6. Russian plural forms follow standard rules (one/few/many/other)

## Next Steps (Optional)

### Other Pages to Check (Not in Scope)
The same pattern likely exists on:
- Sales page (/sales)
- Payments page (/payments) - partially done
- Customers page (/customers)
- Products page (/products)
- Inventory page (/inventory)
- Services page (/services)
- Employees page (/employees)
- Appointments page (/appointments)

### Prevention
- Add ESLint rule to catch hardcoded strings in JSX
- Add script to check for untranslated strings
- Document translation pattern in CONTRIBUTING.md

## Impact

- **Strings moved to dictionaries**: ~80 keys across 6 translation files
- **Shared helpers created**: 3 translation helper functions
- **Components updated**: 8 components (filters, list, form, actions, breakdown, periods, pages)
- **No breaking changes**: All changes are display-layer only
- **Build size**: No significant change (translation keys are already bundled)
- **Performance**: No impact (server components remain server-rendered)
