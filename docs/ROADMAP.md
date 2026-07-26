# Product Roadmap

## MVP (Phase 1) — Core Wholesale Management

**Goal:** Launch-ready application for small wholesale businesses. Focus on credit sales, inventory, and payment tracking.

**Target:** 1-10 employee businesses in Kyrgyzstan selling to 50-500 retailers.

**Timeline:** 8-10 weeks

---

### ✅ Completed (Foundation)

**Architecture & Infrastructure:**
- [x] Database schema (9 tables, RLS policies, triggers)
- [x] Multi-tenant architecture (organization isolation)
- [x] Authentication system (Supabase Auth + JWT claims)
- [x] Repository pattern (service → repository → database)
- [x] Feature-based folder structure
- [x] Domain models (types, validation, business rules)
- [x] Inventory system (automatic adjustments via triggers)
- [x] Sales workflow (draft → completed → cancelled with payment tracking)

**Documentation:**
- [x] Architecture overview
- [x] Database schema & triggers
- [x] Business rules
- [x] API conventions
- [x] Authentication flow
- [x] Inventory system
- [x] Sales workflow
- [x] Onboarding design

---

### 🚧 In Progress (Implementation)

**Repository Layer:**
- [ ] Supabase repository implementations (concrete classes)
- [ ] Query builders for all features
- [ ] Service layer implementations

**UI Components (shadcn/ui):**
- [ ] Base components (Button, Input, Dialog, Table, Form)
- [ ] Layout components (Sidebar, Topbar, PageHeader)
- [ ] Data display (DataTable, EmptyState, LoadingState)
- [ ] Form controls (MoneyInput, DatePicker, SearchInput)

**Authentication UI:**
- [ ] Login page
- [ ] Signup page
- [ ] Password reset flow
- [ ] Email verification handling

**Onboarding Flow (7 steps):**
- [ ] Organization setup
- [ ] Business preferences
- [ ] First product
- [ ] First customer
- [ ] First sale walkthrough
- [ ] Payment recording demo
- [ ] Dashboard introduction

---

### 📋 Planned (MVP Features)

#### Customer Management
- [ ] Customer list (with search, filters)
- [ ] Customer detail page (sales history, balance, payments)
- [ ] Customer form (create/edit)
- [ ] Credit limit warnings
- [ ] Accounts receivable report
- [ ] Customer statement generation

#### Product Management
- [ ] Product list (with categories, low stock indicators)
- [ ] Product detail page (inventory, sales history, profit)
- [ ] Product form (create/edit)
- [ ] Bulk import from CSV
- [ ] Profit margin calculator

#### Inventory Management
- [ ] Inventory overview (all products with stock levels)
- [ ] Low stock alerts (dashboard badge + list)
- [ ] Manual adjustment form (with reason selection)
- [ ] Inventory value dashboard card
- [ ] Stock adjustment history (audit log)

#### Sales Management
- [ ] Sales list (filters: status, customer, date range)
- [ ] Sale creation flow (multi-step: customer → items → review → complete)
- [ ] Sale detail / invoice view
- [ ] Sale editing (draft sales only)
- [ ] Sale completion (with inventory check)
- [ ] Sale cancellation (with confirmation)
- [ ] Print invoice (PDF generation)

#### Payment Management
- [ ] Payment recording form (linked to sale or unallocated)
- [ ] Payment history (by customer, by date)
- [ ] Multiple payment methods support
- [ ] Receipt printing

#### Expense Tracking
- [ ] Expense list (with categories, date filters)
- [ ] Expense form (create/edit)
- [ ] Category breakdown chart
- [ ] Monthly expense summary

#### Reporting & Dashboard
- [ ] Dashboard overview:
  - [ ] Revenue this month
  - [ ] Gross profit this month
  - [ ] Low stock count
  - [ ] Overdue sales count
  - [ ] Top 5 customers by revenue
  - [ ] Top 5 products by sales
- [ ] Sales report (revenue by date range)
- [ ] Profit report (gross profit, net profit)
- [ ] Customer balances report
- [ ] Inventory valuation report

#### User Management
- [ ] User list (for owners/admins)
- [ ] User invitation (email invite link)
- [ ] Role assignment
- [ ] User deactivation

---

## Phase 2 — Enhanced Features (3-4 months)

**Goal:** Add features requested by early customers. Improve usability and automation.

---

### Advanced Inventory

**Multi-Warehouse Support:**
- [ ] Warehouse table and management
- [ ] Inventory per warehouse
- [ ] Warehouse transfers
- [ ] Warehouse-specific reports

**Barcode Scanning:**
- [ ] Product barcode field (already in schema)
- [ ] Barcode scanner integration (mobile camera)
- [ ] Fast sale entry (scan barcode → add to sale)

**Reorder Alerts:**
- [ ] Automatic email/SMS when stock low
- [ ] Reorder level per product (already in schema)
- [ ] Purchase order creation (track incoming stock)

---

### Advanced Sales

**Delivery Tracking:**
- [ ] Delivery status (pending, in transit, delivered)
- [ ] Driver assignment
- [ ] Delivery confirmation with signature
- [ ] Route optimization

**Sale Templates:**
- [ ] Save common sales as templates
- [ ] Quick sale creation from template
- [ ] Recurring sales (weekly/monthly auto-creation)

**Discounts & Promotions:**
- [ ] Customer-specific pricing tiers
- [ ] Time-based promotions
- [ ] Volume discounts
- [ ] Coupon codes

---

### Financial Features

**Advanced Reports:**
- [ ] Year-over-year comparison
- [ ] Product profitability analysis
- [ ] Customer lifetime value
- [ ] Sales forecast (ML-based)
- [ ] Cash flow projection

**Accounting Integration:**
- [ ] QuickBooks export
- [ ] Xero export
- [ ] 1C:Enterprise export (Kyrgyzstan standard)

**Bank Reconciliation:**
- [ ] Bank statement import
- [ ] Auto-match payments to statements
- [ ] Reconciliation report

---

### Mobile App (React Native)

**Why:** Field sales (sales reps visit customers with mobile device).

**Features:**
- [ ] Mobile login
- [ ] Create sales offline (sync when online)
- [ ] Record payments
- [ ] Check inventory
- [ ] Barcode scanning
- [ ] Photo receipt upload

---

### Billing & Subscriptions

**Stripe Integration:**
- [ ] Subscription plans (Free, Basic, Pro, Enterprise)
- [ ] Payment collection
- [ ] Upgrade/downgrade flows
- [ ] Usage-based billing (per user/transaction)

**Plan Limits:**
- Free: 1 user, 100 sales/month
- Basic ($29/mo): 3 users, unlimited sales
- Pro ($79/mo): 10 users, advanced reports, API access
- Enterprise (custom): Unlimited, priority support

---

### Collaboration

**Team Features:**
- [ ] Activity feed (who did what)
- [ ] Comments on sales/customers
- [ ] Notifications (sale completed, payment received)
- [ ] Task assignments (follow up with customer X)

**Permissions:**
- [ ] Granular permissions (beyond just roles)
- [ ] Custom role creation
- [ ] Department-level access

---

### Automation

**Scheduled Reports:**
- [ ] Email daily/weekly/monthly reports
- [ ] Automatic invoice reminders (overdue payments)
- [ ] Low stock notifications

**Webhooks:**
- [ ] POST to URL when sale completed
- [ ] POST when payment received
- [ ] Integration with Zapier/Make

---

## Phase 3 — Scale & Enterprise (6-12 months)

**Goal:** Support larger businesses (10-100 employees, 1000s of customers).

---

### Performance

**Database:**
- [ ] Read replicas (scale reads)
- [ ] Partitioning (sales table by date)
- [ ] Archival (move old data to cold storage)

**Caching:**
- [ ] Redis for session caching
- [ ] CDN for static assets
- [ ] Query result caching (React Query)

**Search:**
- [ ] Elasticsearch for customer/product search
- [ ] Fuzzy matching
- [ ] Faceted search

---

### Enterprise Features

**Advanced Security:**
- [ ] 2FA/MFA
- [ ] SSO (SAML, OAuth)
- [ ] Audit logs (immutable record of all changes)
- [ ] IP allowlisting

**Compliance:**
- [ ] GDPR compliance tools (data export, deletion)
- [ ] SOC 2 certification
- [ ] PCI compliance (if handling card data)

**Multi-Currency:**
- [ ] Support multiple currencies
- [ ] Exchange rate tracking
- [ ] Multi-currency reports

**Multi-Language:**
- [ ] Russian translation (Kyrgyzstan)
- [ ] Turkish translation (Central Asia)
- [ ] Arabic translation (Middle East)

---

### API & Integrations

**Public API:**
- [ ] REST API (full CRUD)
- [ ] GraphQL API (flexible queries)
- [ ] WebSockets (real-time updates)
- [ ] Rate limiting
- [ ] API keys management

**Integration Marketplace:**
- [ ] E-commerce platforms (Shopify, WooCommerce)
- [ ] Shipping providers (FedEx, DHL)
- [ ] Payment gateways (local banks)
- [ ] Accounting software

---

### AI Features

**Smart Insights:**
- [ ] Predict which customers will pay late
- [ ] Suggest optimal reorder quantities
- [ ] Identify at-risk customers (churn prediction)
- [ ] Recommend upsell opportunities

**Chatbot:**
- [ ] "What's my total revenue this month?"
- [ ] "Who owes me the most?"
- [ ] "Show me low stock products"

---

## Technical Debt Backlog

**Items to address as we grow:**

### Code Quality
- [ ] Add comprehensive test coverage (target: 80% business rules)
- [ ] Set up E2E tests (Playwright)
- [ ] Add API integration tests
- [ ] Set up load testing

### Infrastructure
- [ ] Add monitoring (Datadog/New Relic)
- [ ] Set up error tracking (Sentry)
- [ ] Add performance monitoring (Vercel Analytics)
- [ ] Set up log aggregation (Logtail)

### Security
- [ ] Security audit (third-party)
- [ ] Penetration testing
- [ ] Dependency vulnerability scanning
- [ ] Secret scanning (git history)

### Developer Experience
- [ ] Add Storybook for component development
- [ ] Set up automated dependency updates (Renovate)
- [ ] Add commit hooks (lint-staged, husky)
- [ ] Improve local development setup (Docker Compose?)

### Documentation
- [ ] Add API documentation (generated from Zod schemas)
- [ ] Create video tutorials
- [ ] Write troubleshooting guide
- [ ] Add architecture decision records (ADRs)

---

## Feature Requests (From User Feedback)

**Placeholder for customer requests:**

_Will be filled in after MVP launch and customer interviews._

---

## Non-Goals (What We Won't Build)

**Scope discipline — features we explicitly exclude:**

1. **Point of Sale (POS) system** — This is wholesale B2B, not retail B2C
2. **Manufacturing/production tracking** — Scope is distribution, not production
3. **HR/payroll** — Out of scope, use dedicated HR software
4. **Project management** — Not a PM tool
5. **Marketing automation** — No email campaigns, CRM is minimal
6. **Built-in payment processing** — We track payments, not process them (no Stripe Checkout integration)

---

## Success Metrics

**MVP Success Criteria (6 months post-launch):**
- [ ] 50 active organizations (10+ sales per month)
- [ ] 90% feature adoption (users use sales + payments + inventory)
- [ ] < 5% churn rate
- [ ] NPS > 40
- [ ] < 1% error rate
- [ ] < 2s average page load

**Phase 2 Success Criteria (12 months):**
- [ ] 500 active organizations
- [ ] 10% converting to paid plans
- [ ] $10k MRR
- [ ] 1-2 enterprise customers

---

## Release Strategy

### MVP (v1.0)

**Private Beta (Weeks 1-4):**
- Invite 5-10 friendly businesses
- Manual onboarding
- Daily check-ins
- Fix critical bugs immediately

**Public Beta (Weeks 5-8):**
- Open signups (with waitlist)
- Self-serve onboarding
- Weekly check-ins
- Build feedback into Phase 2

**General Availability (Week 9+):**
- Remove beta label
- Start paid plans
- Marketing push

### Phase 2+ (v2.0, v3.0, ...)

**Release cadence:** Monthly releases

**Versioning:**
- Major (v2.0): Breaking changes (rare)
- Minor (v2.1): New features (monthly)
- Patch (v2.1.1): Bug fixes (as needed)

---

## Summary

| Phase | Duration | Key Features | Goal |
|-------|----------|--------------|------|
| **MVP (Phase 1)** | 8-10 weeks | Core wholesale: customers, products, sales, inventory, payments | Launch-ready |
| **Phase 2** | 3-4 months | Multi-warehouse, barcode, mobile app, billing, automation | Power user features |
| **Phase 3** | 6-12 months | Scale, enterprise, API, AI, compliance | Enterprise-ready |

**The roadmap is flexible.** Customer feedback after MVP launch will shape Phase 2 priorities. We build what customers actually need, not what we assume they need.
