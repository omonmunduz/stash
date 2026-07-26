# Application Folder Structure

## Overview

This is a **feature-based architecture** where code is organized by business domain (customers, products, sales) rather than technical layer (components, services, hooks). This structure scales well as the application grows and makes it easy to locate all code related to a specific feature.

---

## Complete Structure

```
src/
├── app/                           ← Next.js App Router (routes + layouts)
│   ├── (auth)/                    ← Route group: authentication
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   └── layout.tsx             ← Auth layout (centered, no sidebar)
│   │
│   ├── (dashboard)/               ← Route group: authenticated app
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── customers/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── new/
│   │   │       └── page.tsx
│   │   ├── products/
│   │   ├── inventory/
│   │   ├── sales/
│   │   ├── payments/
│   │   ├── expenses/
│   │   ├── reports/
│   │   ├── settings/
│   │   └── layout.tsx             ← Dashboard layout (sidebar + topbar)
│   │
│   ├── (onboarding)/              ← Route group: first-time setup
│   │   ├── setup/
│   │   ├── preferences/
│   │   ├── product/
│   │   ├── customer/
│   │   ├── sale/
│   │   ├── complete/
│   │   └── layout.tsx             ← Onboarding layout (progress indicator)
│   │
│   ├── api/                       ← API routes (REST endpoints)
│   │   ├── customers/
│   │   │   └── route.ts
│   │   ├── webhooks/
│   │   │   └── stripe/
│   │   │       └── route.ts
│   │   └── health/
│   │       └── route.ts
│   │
│   ├── actions/                   ← Server Actions (mutations)
│   │   ├── customers.ts
│   │   ├── products.ts
│   │   ├── sales.ts
│   │   └── auth.ts
│   │
│   ├── layout.tsx                 ← Root layout (providers, fonts, metadata)
│   ├── globals.css                ← Global styles
│   ├── not-found.tsx
│   └── error.tsx
│
├── features/                      ← Business domains (feature-based modules)
│   ├── organizations/
│   │   ├── types.ts               ← Domain types
│   │   ├── validation.ts          ← Zod schemas
│   │   ├── business-rules.ts      ← Pure domain logic
│   │   ├── queries.ts             ← Supabase query builders
│   │   ├── repository.ts          ← Data access interface + implementation
│   │   ├── service.ts             ← Business logic orchestration
│   │   ├── hooks.ts               ← React hooks for UI
│   │   └── components/            ← Feature-specific components
│   │       ├── OrganizationSettings.tsx
│   │       └── OrganizationSwitcher.tsx
│   │
│   ├── auth/                      ← Authentication feature
│   │   ├── types.ts
│   │   ├── validation.ts
│   │   ├── service.ts             ← Login, signup, session management
│   │   ├── hooks.ts               ← useAuth, useSession, useUser
│   │   ├── guards.ts              ← Route protection utilities
│   │   └── components/
│   │       ├── LoginForm.tsx
│   │       ├── SignupForm.tsx
│   │       └── ProtectedRoute.tsx
│   │
│   ├── users/
│   │   ├── types.ts
│   │   ├── validation.ts
│   │   ├── business-rules.ts      ← Role hierarchy, permissions
│   │   ├── queries.ts
│   │   ├── repository.ts
│   │   ├── service.ts
│   │   ├── hooks.ts
│   │   └── components/
│   │       ├── UserList.tsx
│   │       ├── UserForm.tsx
│   │       ├── UserRoleBadge.tsx
│   │       └── InviteUserDialog.tsx
│   │
│   ├── customers/
│   │   ├── types.ts
│   │   ├── validation.ts
│   │   ├── business-rules.ts      ← Credit limits, debt calculations
│   │   ├── queries.ts
│   │   ├── repository.ts
│   │   ├── service.ts
│   │   ├── hooks.ts               ← useCustomers, useCustomerDebt
│   │   └── components/
│   │       ├── CustomerList.tsx
│   │       ├── CustomerCard.tsx
│   │       ├── CustomerForm.tsx
│   │       ├── CustomerSearch.tsx
│   │       ├── CreditLimitIndicator.tsx
│   │       └── DebtSummary.tsx
│   │
│   ├── products/
│   │   ├── types.ts
│   │   ├── validation.ts
│   │   ├── business-rules.ts      ← Profit calculations, pricing
│   │   ├── queries.ts
│   │   ├── repository.ts
│   │   ├── service.ts
│   │   ├── hooks.ts
│   │   └── components/
│   │       ├── ProductList.tsx
│   │       ├── ProductCard.tsx
│   │       ├── ProductForm.tsx
│   │       ├── ProductSearch.tsx
│   │       ├── ProfitIndicator.tsx
│   │       └── PricingForm.tsx
│   │
│   ├── inventory/
│   │   ├── types.ts
│   │   ├── validation.ts
│   │   ├── business-rules.ts
│   │   ├── queries.ts
│   │   ├── repository.ts
│   │   ├── service.ts
│   │   ├── hooks.ts
│   │   └── components/
│   │       ├── InventoryTable.tsx
│   │       ├── StockAdjustmentForm.tsx
│   │       ├── LowStockIndicator.tsx
│   │       └── InventoryHistory.tsx
│   │
│   ├── sales/
│   │   ├── types.ts
│   │   ├── validation.ts
│   │   ├── business-rules.ts      ← Total calculations, status logic
│   │   ├── queries.ts
│   │   ├── repository.ts
│   │   ├── service.ts
│   │   ├── hooks.ts
│   │   └── components/
│   │       ├── SalesList.tsx
│   │       ├── SaleForm.tsx       ← Multi-step sale creation
│   │       ├── SaleItemsTable.tsx
│   │       ├── SaleStatusBadge.tsx
│   │       ├── PaymentStatusIndicator.tsx
│   │       └── InvoicePreview.tsx
│   │
│   ├── payments/
│   │   ├── types.ts
│   │   ├── validation.ts
│   │   ├── business-rules.ts
│   │   ├── queries.ts
│   │   ├── repository.ts
│   │   ├── service.ts
│   │   ├── hooks.ts
│   │   └── components/
│   │       ├── PaymentsList.tsx
│   │       ├── PaymentForm.tsx
│   │       ├── PaymentMethodBadge.tsx
│   │       └── PaymentHistory.tsx
│   │
│   ├── expenses/
│   │   ├── types.ts
│   │   ├── validation.ts
│   │   ├── business-rules.ts
│   │   ├── queries.ts
│   │   ├── repository.ts
│   │   ├── service.ts
│   │   ├── hooks.ts
│   │   └── components/
│   │       ├── ExpensesList.tsx
│   │       ├── ExpenseForm.tsx
│   │       ├── CategoryBreakdown.tsx
│   │       └── ReceiptUpload.tsx
│   │
│   ├── reports/                   ← Reporting & analytics feature
│   │   ├── types.ts
│   │   ├── queries.ts             ← Complex aggregation queries
│   │   ├── service.ts             ← Revenue, profit, AR reports
│   │   ├── hooks.ts
│   │   └── components/
│   │       ├── RevenueChart.tsx
│   │       ├── ProfitLossReport.tsx
│   │       ├── CustomerBalancesReport.tsx
│   │       ├── TopProductsChart.tsx
│   │       └── ExportButton.tsx
│   │
│   └── onboarding/                ← First-time user setup
│       ├── types.ts
│       ├── validation.ts
│       ├── service.ts             ← Onboarding state management
│       ├── hooks.ts               ← useOnboarding, useOnboardingStep
│       └── components/
│           ├── OnboardingProgress.tsx
│           ├── WelcomeScreen.tsx
│           ├── BusinessPreferences.tsx
│           ├── FirstProductForm.tsx
│           └── FirstCustomerForm.tsx
│
├── components/                    ← Shared UI components (design system)
│   ├── ui/                        ← Base components (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── table.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── form.tsx
│   │   ├── toast.tsx
│   │   └── ...                    ← Other shadcn/ui primitives
│   │
│   ├── layout/                    ← Layout components
│   │   ├── DashboardLayout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   ├── MobileNav.tsx
│   │   └── PageHeader.tsx
│   │
│   ├── data-display/              ← Data presentation components
│   │   ├── DataTable.tsx          ← Generic table with sorting/filtering
│   │   ├── EmptyState.tsx
│   │   ├── LoadingState.tsx
│   │   ├── ErrorState.tsx
│   │   ├── StatCard.tsx
│   │   └── MetricDisplay.tsx
│   │
│   ├── forms/                     ← Form components
│   │   ├── FormField.tsx          ← Wrapper for react-hook-form fields
│   │   ├── MoneyInput.tsx
│   │   ├── DatePicker.tsx
│   │   ├── SearchInput.tsx
│   │   └── ComboBox.tsx
│   │
│   └── feedback/                  ← User feedback components
│       ├── ConfirmDialog.tsx
│       ├── Alert.tsx
│       ├── ProgressBar.tsx
│       └── Skeleton.tsx
│
├── lib/                           ← Core utilities & infrastructure
│   ├── supabase/
│   │   ├── client.ts              ← Browser client
│   │   ├── server.ts              ← Server client
│   │   ├── admin.ts               ← Admin client (service role)
│   │   └── middleware.ts          ← Session refresh middleware
│   │
│   ├── types/
│   │   ├── common.ts              ← Shared type utilities
│   │   └── database.types.ts      ← Generated Supabase types
│   │
│   ├── utils/
│   │   ├── cn.ts                  ← Tailwind class merge utility
│   │   ├── format.ts              ← Formatting helpers (money, dates)
│   │   ├── validation.ts          ← Common validation helpers
│   │   └── errors.ts              ← Error handling utilities
│   │
│   └── constants/
│       ├── routes.ts              ← Route paths
│       ├── roles.ts               ← User role constants
│       └── settings.ts            ← App-wide constants
│
├── hooks/                         ← Global React hooks
│   ├── useMediaQuery.ts           ← Responsive design
│   ├── useLocalStorage.ts
│   ├── useDebounce.ts
│   ├── usePagination.ts
│   └── useToast.ts                ← Toast notifications
│
├── providers/                     ← React context providers
│   ├── AuthProvider.tsx           ← Auth session context
│   ├── ThemeProvider.tsx          ← Dark mode
│   ├── ToastProvider.tsx          ← Global toast notifications
│   └── QueryProvider.tsx          ← React Query (if using)
│
├── styles/                        ← Styling
│   ├── globals.css
│   └── themes/
│       ├── light.css
│       └── dark.css
│
├── middleware.ts                  ← Next.js middleware (auth, redirects)
│
└── types/                         ← Global TypeScript types
    ├── env.d.ts                   ← Environment variables
    ├── next-auth.d.ts             ← Next Auth extensions (if using)
    └── global.d.ts                ← Global type augmentations
```

---

## Folder Responsibilities

### `app/` — Next.js App Router

**Responsibility:** Route definitions, layouts, and page rendering.

**Contents:**
- Route groups `(auth)`, `(dashboard)`, `(onboarding)` for different layouts
- Page components (`page.tsx`) — fetch data, render feature components
- Layouts (`layout.tsx`) — shared UI shells
- API routes (`api/`) — REST endpoints, webhooks
- Server Actions (`actions/`) — mutations called from client

**Rules:**
- Pages should be **thin** — fetch data, call services, render components
- NO business logic in pages
- NO direct Supabase calls (use services)
- NO complex UI (delegate to feature components)

**Example:**
```typescript
// app/(dashboard)/customers/page.tsx
import { createServerClient } from '@/lib/supabase/server'
import { SupabaseCustomerRepository } from '@/features/customers/repository'
import { CustomerService } from '@/features/customers/service'
import { CustomerList } from '@/features/customers/components/CustomerList'

export default async function CustomersPage() {
  const supabase = await createServerClient()
  const repo = new SupabaseCustomerRepository(supabase)
  const service = new CustomerService(repo, await getOrgId())
  
  const customers = await service.listCustomers()
  
  return <CustomerList customers={customers} />
}
```

---

### `features/` — Business Domains

**Responsibility:** All code for a specific business capability.

**Structure per feature:**
```
features/customers/
├── types.ts              ← Domain types
├── validation.ts         ← Zod schemas
├── business-rules.ts     ← Pure domain logic
├── queries.ts            ← Supabase query builders
├── repository.ts         ← Data access layer
├── service.ts            ← Orchestration layer
├── hooks.ts              ← React hooks for this feature
└── components/           ← UI components for this feature
```

**Why feature-based?**
1. **Locality:** Everything for customers is in `features/customers/`
2. **Scalability:** Adding a new feature doesn't clutter existing folders
3. **Team collaboration:** Different devs work on different features without conflicts
4. **Discoverability:** New team members find code easily

**Rules:**
- Features CAN depend on `lib/`, `components/ui`, `hooks/`
- Features SHOULD NOT depend on other features (prefer composition in `app/`)
- Feature components SHOULD use the feature's own hooks
- Feature hooks SHOULD use the feature's own service

**Example dependency:**
```
features/customers/components/CustomerForm.tsx
    ↓ imports
features/customers/hooks.ts (useCreateCustomer)
    ↓ calls
features/customers/service.ts (CustomerService)
    ↓ calls
features/customers/repository.ts (CustomerRepository)
```

---

### `components/` — Shared UI Components

**Responsibility:** Reusable UI primitives and patterns used across features.

**Structure:**
```
components/
├── ui/              ← Base components (buttons, inputs, dialogs)
├── layout/          ← Layout shells (sidebar, topbar)
├── data-display/    ← Tables, cards, empty states
├── forms/           ← Form controls
└── feedback/        ← Alerts, modals, toasts
```

**Rules:**
- Components should be **generic** (not tied to a business domain)
- NO business logic
- NO data fetching
- NO direct Supabase calls
- Accept all data via props
- Style with Tailwind + shadcn/ui

**Example:**
```typescript
// ✅ GOOD: Generic, reusable
export function DataTable<T>({ columns, data, onSort }: Props<T>) {
  return <table>...</table>
}

// ❌ BAD: Feature-specific
export function CustomerTable({ customerId }: Props) {
  const customers = useCustomers(customerId) // ← Don't fetch here
  return <table>...</table>
}
```

**Feature components live in `features/{name}/components/`**, not here.

---

### `lib/` — Core Infrastructure

**Responsibility:** Low-level utilities and third-party integrations.

**Contents:**
- `supabase/` — Database clients
- `types/` — Shared TypeScript utilities
- `utils/` — Helper functions (formatting, validation)
- `constants/` — App-wide constants

**Rules:**
- Pure functions preferred
- NO UI components
- NO React hooks (those go in `hooks/`)
- NO feature-specific code

**Examples:**
- `lib/utils/format.ts` — `formatMoney(1234.56, 'KGS')` → `"1,234.56 KGS"`
- `lib/utils/errors.ts` — `mapSupabaseError(error)` → user-friendly message
- `lib/constants/routes.ts` — `ROUTES.customers.list` → `/customers`

---

### `hooks/` — Global React Hooks

**Responsibility:** Reusable React hooks that aren't tied to a specific feature.

**Examples:**
- `useMediaQuery.ts` — Detect responsive breakpoints
- `useDebounce.ts` — Debounce search inputs
- `useLocalStorage.ts` — Persist state to localStorage
- `usePagination.ts` — Generic pagination logic

**Rules:**
- NO business logic
- NO feature-specific hooks (those go in `features/{name}/hooks.ts`)
- Should be generic enough to use in multiple features

**Feature hooks** like `useCustomers` or `useCreateSale` live in `features/{name}/hooks.ts`.

---

### `providers/` — React Context Providers

**Responsibility:** Global app state providers.

**Examples:**
- `AuthProvider.tsx` — Current user session
- `ThemeProvider.tsx` — Dark/light mode
- `ToastProvider.tsx` — Global toast notifications
- `QueryProvider.tsx` — React Query cache (if using)

**Rules:**
- Wrap in `app/layout.tsx` (root layout)
- Keep lightweight (don't put heavy logic here)
- Avoid prop drilling by providing context

**Example:**
```typescript
// providers/AuthProvider.tsx
export function AuthProvider({ children }: Props) {
  const user = useSupabaseUser()
  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  )
}

// app/layout.tsx
export default function RootLayout({ children }: Props) {
  return (
    <html>
      <body>
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
```

---

### `types/` — Global TypeScript Types

**Responsibility:** Type definitions that don't fit elsewhere.

**Examples:**
- `env.d.ts` — Environment variable types
- `next-auth.d.ts` — Next Auth type extensions
- `global.d.ts` — Global type augmentations

**Rules:**
- Domain types go in `features/{name}/types.ts`
- Utility types go in `lib/types/common.ts`
- Only truly global types go here

---

## Feature-Based vs Layer-Based

### ❌ Layer-Based (Old Way)

```
src/
├── components/
│   ├── CustomerList.tsx
│   ├── CustomerForm.tsx
│   ├── ProductList.tsx
│   ├── ProductForm.tsx
│   └── ... (100+ components mixed together)
├── services/
│   ├── customerService.ts
│   ├── productService.ts
│   └── ...
├── hooks/
│   ├── useCustomers.ts
│   ├── useProducts.ts
│   └── ...
```

**Problems:**
- Hard to find related code
- Components folder becomes massive
- No clear boundaries between features
- Difficult to delete a feature (code scattered everywhere)

### ✅ Feature-Based (Our Way)

```
src/
├── features/
│   ├── customers/       ← Everything customer-related
│   │   ├── types.ts
│   │   ├── service.ts
│   │   ├── hooks.ts
│   │   └── components/
│   └── products/        ← Everything product-related
│       ├── types.ts
│       ├── service.ts
│       ├── hooks.ts
│       └── components/
```

**Benefits:**
- Related code is co-located
- Easy to find everything for a feature
- Clear boundaries
- Easy to delete a feature (delete one folder)
- Team members own features, not layers

---

## Dependency Rules

```
app/ (pages)
    ↓ can import from
features/ (business domains)
    ↓ can import from
components/ (shared UI), lib/ (utilities), hooks/ (global hooks)
    ↓ can import from
(nothing — these are leaves)
```

**Rules:**
- Pages import from features
- Features import from shared layers (`components/`, `lib/`, `hooks/`)
- Features do NOT import from other features (compose in `app/` instead)
- Shared layers do NOT import from features

---

## Summary

| Folder | Contains | Imports From | Imported By |
|--------|----------|--------------|-------------|
| `app/` | Routes, pages, layouts | `features/`, `components/` | (entry point) |
| `features/` | Business logic per domain | `lib/`, `components/`, `hooks/` | `app/` |
| `components/` | Shared UI primitives | `lib/`, `hooks/` | `app/`, `features/` |
| `lib/` | Utilities, DB clients | (nothing) | Everything |
| `hooks/` | Global React hooks | `lib/` | `app/`, `features/`, `components/` |
| `providers/` | React context | `hooks/`, `lib/` | `app/layout.tsx` |
| `types/` | Global types | (nothing) | Everything |

This structure **scales from MVP to enterprise** without major refactoring.
