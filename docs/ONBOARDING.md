# Onboarding Experience Design

## Overview

The onboarding experience is the first impression every new user gets.
It must be simple, fast, and work for any wholesale business — from a
cookie distributor in Bishkek to an electronics wholesaler in Istanbul.

The goal is not to show features. The goal is to get the user to their
first real business action as quickly as possible.

---

## Design Principles

1. **Business-agnostic** — Never assume what products or customers exist
2. **Mobile-first** — Many small business owners use phones, not computers
3. **Progressive** — Each step builds on the previous one logically
4. **Skippable** — No step except account and organization is mandatory
5. **Resumable** — Closing the browser mid-onboarding does not lose progress
6. **Minimal friction** — Ask only what is truly needed at each step
7. **Contextual help** — Explain concepts (SKU, credit limit) inline, not in a manual

---

## Onboarding State Tracking

Onboarding progress is stored on the organization record using the
existing `settings` JSONB column. No new table is needed.

```json
{
  "onboarding": {
    "completed": false,
    "current_step": "preferences",
    "steps_completed": ["account", "organization"],
    "skipped_steps": [],
    "completed_at": null
  }
}
```

This means:
- Progress survives page refresh and browser close
- Returning users resume exactly where they left off
- Once `completed: true`, onboarding never shows again
- Skipped steps are tracked so we can surface nudges later

---

## Complete User Journey

```
Landing Page
     │
     ▼
[Step 1] Create Account        ← No skip. Required to proceed.
     │
     ▼
[Step 2] Create Organization   ← No skip. Required to proceed.
     │
     ▼
[Step 3] Business Preferences  ← Skip allowed. Defaults applied.
     │
     ▼
[Step 4] Add First Product     ← Skip allowed. Dashboard shows empty state.
     │
     ▼
[Step 5] Add First Customer    ← Skip allowed. Dashboard shows empty state.
     │
     ▼
[Step 6] Record First Sale     ← Skip allowed. Shown only if steps 4+5 done.
     │
     ▼
[Step 7] You're Ready          ← Always shown. Summary + next actions.
     │
     ▼
Dashboard
```

---

## Step 1 — Create Account

### Purpose
Authenticate the user with Supabase Auth. This is the entry point.

### Screen Layout
```
┌────────────────────────────────┐
│                                │
│   [App Logo]                   │
│   Welcome to [App Name]        │
│   Wholesale business made easy │
│                                │
│   Full name                    │
│   ┌──────────────────────────┐ │
│   │                          │ │
│   └──────────────────────────┘ │
│                                │
│   Email address                │
│   ┌──────────────────────────┐ │
│   │                          │ │
│   └──────────────────────────┘ │
│                                │
│   Password                     │
│   ┌──────────────────────────┐ │
│   │                          │ │
│   └──────────────────────────┘ │
│                                │
│   [Create Account]             │
│                                │
│   Already have an account?     │
│   Sign in                      │
│                                │
└────────────────────────────────┘
```

### Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Full name | text | yes | 2–100 chars |
| Email | email | yes | Valid email format |
| Password | password | yes | Min 8 chars, 1 number |

### Behavior
- Submit creates `auth.users` record via Supabase Auth
- Supabase sends verification email automatically
- User is redirected to Step 2 immediately (no waiting for email)
- Verification banner shown at top of onboarding ("Please verify your email")
- If user logs in from another device without verifying, redirect to verify page

### Error States
- Email already registered → "An account with this email already exists. Sign in?"
- Password too weak → Inline hint below the field
- Network error → "Something went wrong. Please try again."

### Why Full Name Here?
Collected at signup because it is needed immediately in Step 2 to
personalize the welcome message and pre-fill the user profile.

---

## Step 2 — Create Organization

### Purpose
Create the tenant. This is the business identity. Every piece of data
the user creates belongs to this organization.

### Screen Layout
```
┌────────────────────────────────┐
│                                │
│   Step 1 of 5                  │
│   ●────○────○────○────○        │
│                                │
│   What's your business name?   │
│                                │
│   Business name                │
│   ┌──────────────────────────┐ │
│   │                          │ │
│   └──────────────────────────┘ │
│                                │
│   What kind of business is it? │
│   (Optional — helps us         │
│   customize your experience)   │
│                                │
│   ┌──────────────────────────┐ │
│   │ Food & Beverages      ▾  │ │
│   └──────────────────────────┘ │
│                                │
│   ○ Food & Beverages           │
│   ○ Electronics                │
│   ○ Clothing & Textiles        │
│   ○ Building Materials         │
│   ○ Pharmaceuticals            │
│   ○ Auto Parts                 │
│   ○ Agricultural Products      │
│   ○ Other                      │
│                                │
│   [Continue →]                 │
│                                │
└────────────────────────────────┘
```

### Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Business name | text | yes | 2–100 chars |
| Business type | select | no | Predefined list + "Other" |

### Behavior
- Business name auto-generates the organization `slug`
  - "Ali's Wholesale" → `alis-wholesale`
  - Conflict resolution: `alis-wholesale-2`, `alis-wholesale-3`
- Business type stored in `organizations.settings.business_type`
  - Used for Phase 2 onboarding hints ("common products in your industry")
  - Never used to restrict what products can be created
- Creates `organizations` record on submit
- Creates `user_profiles` record with `role: 'owner'`
- Sets `onboarding.current_step = 'preferences'`

### Why Business Type Is Optional
The app works identically regardless of business type. It is purely a
hint field that helps us show relevant onboarding copy in the future.
It should never gate functionality.

---

## Step 3 — Business Preferences

### Purpose
Set the operational preferences that affect how the entire app displays
data. Getting these right from the start prevents confusion later.

### Screen Layout
```
┌────────────────────────────────┐
│                                │
│   Step 2 of 5                  │
│   ●────●────○────○────○        │
│                                │
│   Set up your preferences      │
│   You can change these later   │
│   in Settings.                 │
│                                │
│   Currency                     │
│   ┌──────────────────────────┐ │
│   │ KGS – Kyrgyzstani Som ▾  │ │
│   └──────────────────────────┘ │
│                                │
│   Language                     │
│   ┌──────────────────────────┐ │
│   │ English               ▾  │ │
│   └──────────────────────────┘ │
│                                │
│   Time zone                    │
│   ┌──────────────────────────┐ │
│   │ Asia/Bishkek (UTC+6)  ▾  │ │
│   └──────────────────────────┘ │
│                                │
│   [Save & Continue →]          │
│   [Skip for now]               │
│                                │
└────────────────────────────────┘
```

### Fields

| Field | Type | Required | Default |
|-------|------|----------|---------|
| Currency | select | no | Auto-detected from browser |
| Language | select | no | Auto-detected from browser |
| Time zone | select | no | Auto-detected from browser |

### Supported Currencies (MVP)
Focus on the regions where the first users will be:

| Code | Name |
|------|------|
| KGS | Kyrgyzstani Som |
| KZT | Kazakhstani Tenge |
| RUB | Russian Ruble |
| UZS | Uzbekistani Sum |
| USD | US Dollar |
| EUR | Euro |
| TRY | Turkish Lira |
| CNY | Chinese Yuan |
| GBP | British Pound |

Full ISO 4217 list available via search.

### Supported Languages (MVP)
| Code | Name |
|------|------|
| en | English |
| ru | Русский (Russian) |
| ky | Кыргызча (Kyrgyz) |

Add more languages post-MVP based on user demand.

### Behavior
- Browser locale used to pre-select defaults
- If skip is chosen, sensible defaults are applied:
  - Currency: USD (most universally understood)
  - Language: Browser default or English
  - Timezone: Browser timezone
- All values stored in `organizations.settings`
- Changes here are reflected instantly across the app

### Why This Step Matters
Currency is not cosmetic. If a business owner sets up in USD but
operates in KGS, every number in every report will be meaningless.
Getting this right at setup prevents silent data quality issues.

---

## Step 4 — Add First Product

### Purpose
Teach the user what a product is in this system, and give them the
satisfaction of having created something real.

### Screen Layout
```
┌────────────────────────────────┐
│                                │
│   Step 3 of 5                  │
│   ●────●────●────○────○        │
│                                │
│   Add your first product       │
│                                │
│   Products are the items your  │
│   business buys and sells.     │
│                                │
│   Product name         *       │
│   ┌──────────────────────────┐ │
│   │ e.g. "Sugar 50kg bag"    │ │
│   └──────────────────────────┘ │
│                                │
│   SKU (product code)           │
│   ┌──────────────────────────┐ │
│   │ e.g. "SGR-50KG"          │ │
│   └──────────────────────────┘ │
│   A unique code for this       │
│   product. We'll suggest one.  │
│                                │
│   Category (optional)          │
│   ┌──────────────────────────┐ │
│   │ e.g. "Groceries"         │ │
│   └──────────────────────────┘ │
│                                │
│   Cost price          *        │
│   ┌──────────────────────────┐ │
│   │                    KGS   │ │
│   └──────────────────────────┘ │
│   What you pay for it          │
│                                │
│   Selling price        *       │
│   ┌──────────────────────────┐ │
│   │                    KGS   │ │
│   └──────────────────────────┘ │
│   What your customer pays      │
│                                │
│   Starting stock quantity      │
│   ┌──────────────────────────┐ │
│   │ 0                        │ │
│   └──────────────────────────┘ │
│                                │
│   Margin: — %                  │
│   (Updates as you type prices) │
│                                │
│   [Add Product →]              │
│   [Skip for now]               │
│                                │
└────────────────────────────────┘
```

### Fields

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| Product name | yes | 2–100 chars | No constraints on what it can be |
| SKU | no | Auto-generated if empty | Suggested from name: "Sugar 50kg" → "SGR-50KG" |
| Category | no | Free text, 2–50 chars | No predefined list — user types anything |
| Cost price | yes | Number > 0 | What the business pays suppliers |
| Selling price | yes | Number > 0 | What customers pay |
| Starting quantity | no | Integer ≥ 0, default 0 | Creates initial inventory record |

### Live Calculations
As the user types cost and selling price, show:
```
Margin: 37.5%   Profit per unit: 3.00 KGS
```
This teaches the user the value of tracking both prices.

### SKU Auto-Suggestion
When the user types a product name and leaves the field, auto-suggest a SKU:
- Take first letters of each word → "Sugar 50kg Bag" → "S-50KB"
- If conflict exists, append a number → "S-50KB-2"
- User can override freely

### Category Field Design
Free text input, NOT a predefined dropdown.

Why: We cannot know what categories a pharmacy uses vs. a hardware store.
In Phase 2, categories become their own entity with autocomplete from
the user's own history.

### Behavior on Submit
1. Create `products` record with `organization_id`
2. Create `inventory` record with `quantity_on_hand = starting_quantity`
3. Set `onboarding.steps_completed` += `'product'`
4. Advance to Step 5

### Behavior on Skip
1. Set `onboarding.skipped_steps` += `'product'`
2. Step 6 (First Sale) will be hidden (cannot sell without a product)
3. Dashboard shows "Add your first product" empty state card

---

## Step 5 — Add First Customer

### Purpose
Establish who the business sells to. Introduce the concept of a credit
limit since credit sales are the core use case.

### Screen Layout
```
┌────────────────────────────────┐
│                                │
│   Step 4 of 5                  │
│   ●────●────●────●────○        │
│                                │
│   Add your first customer      │
│                                │
│   A customer is someone who    │
│   buys products from you.      │
│   They may pay immediately     │
│   or on credit.                │
│                                │
│   Customer name        *       │
│   ┌──────────────────────────┐ │
│   │ e.g. "Ahmed Store"       │ │
│   └──────────────────────────┘ │
│                                │
│   Phone number                 │
│   ┌──────────────────────────┐ │
│   │ e.g. "+996 700 123 456"  │ │
│   └──────────────────────────┘ │
│                                │
│   Credit limit                 │
│   ┌──────────────────────────┐ │
│   │                    KGS   │ │
│   └──────────────────────────┘ │
│   The maximum amount they can  │
│   owe you at one time.         │
│   Leave empty for no limit.    │
│                                │
│   [Add Customer →]             │
│   [Skip for now]               │
│                                │
└────────────────────────────────┘
```

### Fields

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| Customer name | yes | 2–100 chars | Person or business name, no constraints |
| Phone | no | Any format | They enter what makes sense locally |
| Credit limit | no | Number ≥ 0 | Empty = no limit enforced |

### Why So Few Fields?
The full customer form has email, address, city, notes, etc.
During onboarding we only ask for what's needed to make a first sale.
Every other field is available once they reach the Customers section.

### Credit Limit Explanation
Show a brief contextual note:

> "A credit limit prevents a customer from owing more than a set
> amount. For example, if the limit is 10,000 KGS, the system will
> warn you when recording a sale that would exceed it."

This introduces the concept without assuming they know accounting.

### Auto-Generated Customer Code
Customer code (`CUST-0001`) is generated automatically.
Not shown to user during onboarding — they can see it in the
customer's detail page later.

### Behavior on Submit
1. Create `customers` record with `organization_id`
2. Set `onboarding.steps_completed` += `'customer'`
3. Advance to Step 6 if both product and customer exist, else Step 7

### Behavior on Skip
1. Set `onboarding.skipped_steps` += `'customer'`
2. Step 6 (First Sale) is hidden
3. Dashboard shows "Add your first customer" empty state card

---

## Step 6 — Record First Sale

### Purpose
Walk the user through the most important workflow in the entire app.
Only shown if Step 4 and Step 5 were completed (need at least one
product and one customer to make a sale).

### Screen Layout
```
┌────────────────────────────────┐
│                                │
│   Step 5 of 5                  │
│   ●────●────●────●────●        │
│                                │
│   Record your first sale       │
│                                │
│   Let's see how a sale works.  │
│                                │
│   Customer                     │
│   ┌──────────────────────────┐ │
│   │ [Customer added in step 5]│ │
│   └──────────────────────────┘ │
│                                │
│   Products                     │
│   ┌──────────────────────────┐ │
│   │ [Product added in step 4]▾│ │
│   └──────────────────────────┘ │
│                                │
│   Quantity                     │
│   ┌──────────────────────────┐ │
│   │ 1                        │ │
│   └──────────────────────────┘ │
│                                │
│   ┌──────────────────────────┐ │
│   │  Subtotal         8.00   │ │
│   │  Total            8.00   │ │
│   └──────────────────────────┘ │
│                                │
│   Payment received now?        │
│   ○ Full payment (8.00 KGS)    │
│   ○ Partial payment            │
│   ○ No payment (credit sale)   │
│                                │
│   [Record Sale →]              │
│   [Skip for now]               │
│                                │
└────────────────────────────────┘
```

### Fields

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| Customer | yes (pre-filled) | Customer from Step 5 | Can change |
| Product | yes (pre-filled) | Product from Step 4 | Can change |
| Quantity | yes | 1 | |
| Payment option | yes | "No payment" | Teaches credit concept |

### Payment Options
Three choices teach the three payment scenarios immediately:

1. **Full payment** — Customer pays everything now. `amount_paid = total`, `payment_status = 'paid'`
2. **Partial payment** — Shows input for partial amount. `payment_status = 'partial'`
3. **No payment (credit sale)** — Customer owes full amount. `payment_status = 'unpaid'`

This single screen teaches the core product concept without any manual.

### Behavior on Submit
1. Create `sales` record with status `'completed'`
2. Create `sale_items` record for the product
3. If payment received, create `payments` record
4. Triggers update inventory, customer balance automatically
5. Set `onboarding.steps_completed` += `'sale'`
6. Advance to Step 7

### Behavior on Skip
1. Set `onboarding.skipped_steps` += `'sale'`
2. Dashboard shows "Record your first sale" empty state card

---

## Step 7 — You're Ready

### Purpose
Celebrate the completion of onboarding. Show a summary of what was
created. Give clear next actions.

### Screen Layout
```
┌────────────────────────────────┐
│                                │
│           🎉                   │
│                                │
│   You're all set,              │
│   [Business Name]!             │
│                                │
│   Here's what you created:     │
│   ✅ Your business profile      │
│   ✅ 1 product added            │
│   ✅ 1 customer added           │
│   ✅ 1 sale recorded            │
│                                │
│   ── Skipped? Add them now ──  │
│   ○ Add products               │
│   ○ Add customers              │
│                                │
│   What would you like to       │
│   do next?                     │
│                                │
│   [Go to Dashboard]            │
│   [Add more products]          │
│   [Add more customers]         │
│                                │
└────────────────────────────────┘
```

### Behavior
- Sets `onboarding.completed = true`, `onboarding.completed_at = now()`
- Onboarding never appears again after this step
- Any skipped steps shown as action cards on the dashboard
- "Go to Dashboard" leads to the main application

---

## Empty States After Onboarding

If the user skipped steps, the dashboard shows targeted empty states
instead of blank screens. Each empty state has a single clear action.

### Products Empty State
```
┌────────────────────────────────┐
│                                │
│   📦  No products yet          │
│                                │
│   Add the products your        │
│   business sells to start      │
│   recording sales.             │
│                                │
│   [Add your first product →]  │
│                                │
└────────────────────────────────┘
```

### Customers Empty State
```
┌────────────────────────────────┐
│                                │
│   👥  No customers yet         │
│                                │
│   Add the businesses or        │
│   people you sell to.          │
│                                │
│   [Add your first customer →] │
│                                │
└────────────────────────────────┘
```

### Sales Empty State
```
┌────────────────────────────────┐
│                                │
│   🧾  No sales yet             │
│                                │
│   Record a sale every time     │
│   a customer picks up goods.   │
│                                │
│   [Record your first sale →]  │
│                                │
└────────────────────────────────┘
```

---

## Returning Users (Incomplete Onboarding)

If a user created an account and organization but never finished
onboarding, show a resumable banner at the top of the dashboard:

```
┌────────────────────────────────────────────────────────────────┐
│ 🚀 Finish setting up your business    [Continue setup →]   ✕  │
└────────────────────────────────────────────────────────────────┘
```

Dismissing the banner sets `onboarding.completed = true` and skips
all remaining steps. The user can always re-access setup through
Settings → Business Setup.

---

## Onboarding Database Requirements

No new tables are needed. Everything fits into existing structures.

### `organizations.settings` additions

```json
{
  "currency": "KGS",
  "language": "en",
  "timezone": "Asia/Bishkek",
  "business_type": "food_beverages",
  "onboarding": {
    "completed": false,
    "current_step": "product",
    "steps_completed": ["account", "organization", "preferences"],
    "skipped_steps": [],
    "started_at": "2024-07-23T10:00:00Z",
    "completed_at": null
  }
}
```

### Onboarding Steps Enum
```
account       → Supabase Auth user created
organization  → Organization + user_profile created
preferences   → Currency, language, timezone saved
product       → First product created
customer      → First customer created
sale          → First sale recorded
```

---

## URL Structure

```
/signup                → Step 1: Create Account
/onboarding/setup      → Step 2: Create Organization
/onboarding/preferences → Step 3: Business Preferences
/onboarding/product    → Step 4: Add First Product
/onboarding/customer   → Step 5: Add First Customer
/onboarding/sale       → Step 6: Record First Sale
/onboarding/complete   → Step 7: You're Ready
/dashboard             → Main application
```

All `/onboarding/*` routes are protected:
- Must be authenticated
- Must have an organization (except `/onboarding/setup`)
- Redirect to `/dashboard` if `onboarding.completed = true`

---

## Route Guards

```
Unauthenticated user → /signup
Authenticated, no organization → /onboarding/setup
Authenticated, onboarding incomplete → /onboarding/[current_step]
Authenticated, onboarding complete → /dashboard
```

---

## What Is Never In The Onboarding

| Item | Reason |
|------|--------|
| Demo products | App must be product-agnostic |
| Demo customers | App must be customer-agnostic |
| Suggested categories | Would bias toward one industry |
| Pricing examples in specific products | Would imply what businesses should sell |
| SKU format requirements | Every business has its own conventions |
| Mandatory fields beyond name | Reduces friction, more fields available later |
| Billing/subscription | MVP: all on trial, no enforcement |
| Team member invites | Owner sets up business first, invites later |

---

## Phase 2 Onboarding Additions

These items are NOT in the MVP onboarding but should be designed later:

1. **Invite team members** — After owner completes setup
2. **Import products from CSV** — For businesses with large catalogs
3. **Connect suppliers** — When supplier management feature ships
4. **Configure invoice template** — When invoice printing ships
5. **Set up low-stock alerts** — When inventory alerts ship
6. **Business logo upload** — For invoice branding

---

## Summary

| Step | Required | Skip Allowed | Creates |
|------|----------|--------------|---------|
| 1. Create Account | Yes | No | auth.users |
| 2. Create Organization | Yes | No | organizations, user_profiles |
| 3. Business Preferences | No | Yes | organizations.settings update |
| 4. Add First Product | No | Yes | products, inventory |
| 5. Add First Customer | No | Yes | customers |
| 6. Record First Sale | No | Yes (also hidden if 4/5 skipped) | sales, sale_items, payments |
| 7. You're Ready | N/A | N/A | onboarding.completed = true |
