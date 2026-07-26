# Project Context

This document serves as the permanent memory and context for this project.

## 1. Project Vision

We are building a production-quality SaaS application for small wholesale businesses.

**First Customer:** My mother's business
- Sells cookies, candy, chips, and packaged goods
- Many customers purchase products on credit and pay later

## 2. Product Goals

The application should help businesses manage:

- **Customers** – Customer records and contact information
- **Customer debt / accounts receivable** – Track credit purchases and outstanding balances
- **Products** – Product catalog and pricing
- **Inventory** – Stock levels and inventory tracking
- **Sales** – Sales transactions and order history
- **Payments** – Payment collection and reconciliation
- **Expenses** – Business expense tracking
- **Reports** – Business analytics and insights

## 3. MVP Scope (Phase 1)

**Core Features for First Release:**

- ✅ Authentication (Supabase Auth)
- ✅ Multi-tenant foundation (organizations with subscription foundation)
- ✅ User management (owner, admin, manager, employee roles)
- ✅ Customer management (with credit limits and debt tracking)
- ✅ Product catalog (with cost/sale pricing for profit calculation)
- ✅ Simple inventory (single location, quantity tracking)
- ✅ Sales/invoices (with line items, partial payments support)
- ✅ Manual payment recording (ledger only, no payment processing)
- ✅ Expense tracking (categories, vendors, receipts)
- ✅ Basic reports (sales, customer balances, inventory, profit)

**MVP Constraints:**

- One organization per account
- No subscription enforcement (all orgs on "trial" tier)
- No billing logic or Stripe integration
- Single warehouse/location per organization
- No barcode scanning
- No invoice PDF generation
- No email notifications
- No advanced analytics

## 4. Long-Term Vision (Phase 2+)

**SaaS Expansion:**

- Subscription tiers (free, basic, pro, enterprise)
- Stripe integration
- Trial periods and billing portal
- Organization upgrades
- Team member limits based on plan
- Storage limits and feature flags
- Usage-based billing (optional)

**Advanced Features:**

- Multiple warehouses per organization
- Barcode scanning
- Mobile application (React Native/Expo)
- Invoice PDF printing and customization
- Supplier management
- Purchase orders
- AI business assistant
- Sales forecasting
- Advanced analytics and dashboards
- Email/SMS notifications
- API for third-party integrations

## 4. Technology Stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

### Backend
- Supabase
- PostgreSQL

## 5. Engineering Principles

Always follow:

- **Feature-based architecture** – Organize code by feature, not by type
- **Clean code** – Readable, maintainable, and well-documented
- **Strong TypeScript typing** – Leverage the type system fully
- **Reusable components** – DRY principles and component composability
- **Scalable database design** – Think multi-tenant from day one
- **Production-quality practices** – Build it right the first time
- **Avoid unnecessary complexity** – YAGNI (You Aren't Gonna Need It)
- **Prefer maintainability over quick hacks** – Technical debt is expensive

## 6. Development Rules

### Before implementing features:

- Explain architectural decisions
- Think about future scalability
- Consider database implications
- Consider security
- Consider user experience

**Do not build large features without planning.**

## 7. Product Philosophy

The application should feel like:

> **"A digital notebook that thinks."**

### Target Users
Small business owners who are not accountants or technical users.

### Interface Requirements
The interface must be:

- **Simple** – Minimal cognitive load
- **Fast** – Responsive and performant
- **Mobile-first** – Works seamlessly on phones
- **Easy to learn** – Intuitive without training
- **Minimal clicks** – Reduce friction in common workflows

## 8. Current Development Approach

Work like a senior startup engineer.

### For every task:

1. **Analyze requirements** – Understand the problem deeply
2. **Explain approach** – Communicate the plan before implementation
3. **Implement only the requested scope** – No feature creep
4. **Explain decisions** – Document why, not just what
5. **Suggest the next logical step** – Provide guidance for iteration
6. **Wait for approval before continuing** – Collaborate, don't assume

**Never blindly generate code without understanding the architecture.**

---

*Last updated: 2026-07-23*
